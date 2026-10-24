#include <juce_gui_extra/juce_gui_extra.h>
#include <map>
#include <copyfile.h>
#include "Engine.h"
#include "Settings.h"

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
std::string slurPanelUp (bool cancel);
void slurStyleWindow (void* nsView);
void slurProjectIcon (const char* folder);
bool slurKeysToPage (void* nsView);
bool slurDropsKnown (void* nsView);
std::string slurDroppedPaths();
std::string slurCommandKey (void* nsView, const char* letter, unsigned short keyCode);
std::string slurCommandKeyOn();
bool slurSetMenus (const char* json);
void slurSetMenuState (const char* json);
void slurSetTyping (bool on);
std::string slurTestMenuKey (void* nsView, const char* chars, unsigned short keyCode, unsigned long mods);
std::string slurTestRealKey (void* nsView, const char* chars, unsigned short keyCode, unsigned long mods);
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

/*  Where things are kept. A project made since 2026-10-16 lies in a folder of its own, as Logic's do (his ask: "새 프로젝트를
    만들때 프로젝트 파일이 폴더로… 그 폴더 안에는 .sls 파일, audio files 폴더, bounce 폴더"):
        <name>/<name>.sls      the project itself (a folder the Finder shows as one file: project.json + backups/)
        <name>/Audio Files     every sound the project uses: brought in, recorded, joined, bounced in place
        <name>/Bounces         where its hand-offs go unless another place is picked
    A project from before is <name>.sls alone, its sounds inside it (audio/): it is read and written as it is, and stays
    so (nothing of his is moved by itself). A new one is made in Music/Slur Studio/Projects, which macOS lets an app use
    without asking; Save As puts one wherever the Mac's own panel is pointed. The page knows a project by its bare name
    while it (or its folder) lies in that first place, and by its whole path anywhere else. Settings are in Application
    Support. A project from before the name was settled (<name>.slur) is read and written where it is. (daw::musicRoot,
    in Engine.h.) */
juce::File projectsRoot() { return daw::musicRoot().getChildFile ("Projects"); }
bool isProjectKind (const juce::File& f) { const auto ext = f.getFileExtension().toLowerCase(); return ext == ".sls" || ext == ".slur"; }
const char* const AUDIO_FILES = "Audio Files";
const char* const BOUNCES = "Bounces";
/** The folder a project lies in when it has one of its own (<name>/<name>.sls beside Audio Files); none for one from before.
    Known by what it holds, not by its name: a project's folder copied to another Mac, or sent and renamed by the Finder
    ("DRESS 2"), is still its home. One from before keeps its sounds inside itself (audio/) wherever it lies. */
juce::File projectHome (const juce::File& dir)
{
    const auto p = dir.getParentDirectory();
    if (p == projectsRoot() || dir.getChildFile ("audio").isDirectory()) return {};
    if (p.getChildFile (AUDIO_FILES).isDirectory()) return p;
    return p.getFileName() == dir.getFileNameWithoutExtension() && ! dir.exists() ? p : juce::File();      // (one not made yet, in a folder of its own: that folder is its home — a sound brought in before it is first saved goes to its Audio Files)
}
/** The project a folder of a project's own holds, or none: the folder is then a plain one (a person's, among the projects).
    The one named as the folder is; else the only project in it (the folder was renamed). */
juce::File projectIn (const juce::File& home)
{
    if (! home.isDirectory() || isProjectKind (home) || ! home.getChildFile (AUDIO_FILES).isDirectory()) return {};
    for (auto* ext : { ".sls", ".slur" }) { const auto f = home.getChildFile (home.getFileName() + ext); if (f.getChildFile ("project.json").existsAsFile()) return f; }
    juce::File only;
    for (const auto& f : home.findChildFiles (juce::File::findDirectories, false, "*"))
        if (isProjectKind (f) && f.getChildFile ("project.json").existsAsFile()) { if (only != juce::File()) return {}; only = f; }
    return only;
}
bool isProjectHome (const juce::File& d) { return projectIn (d) != juce::File(); }
/** Where a project's sounds are, and where its bounces go by themselves (none for one from before: as it always was). */
juce::File audioDirOf (const juce::File& dir) { const auto h = projectHome (dir); return h != juce::File() ? h.getChildFile (AUDIO_FILES) : dir.getChildFile ("audio"); }
juce::File bouncesDirOf (const juce::File& dir) { const auto h = projectHome (dir); return h != juce::File() ? h.getChildFile (BOUNCES) : juce::File(); }
/** A project about to be written for the first time in a folder of its own: the folder, Audio Files and Bounces are made first */
void makeHome (const juce::File& dir)
{
    const auto p = projectHome (dir);
    if (dir.exists() || p == juce::File()) return;
    p.getChildFile (AUDIO_FILES).createDirectory(); p.getChildFile (BOUNCES).createDirectory();
    slurProjectIcon (p.getFullPathName().toRawUTF8());      // (its own icon in the Finder: Mac.mm)
}
juce::File projectDir (const juce::String& key)
{
    const auto k = key.trim();
    if (juce::File::isAbsolutePath (k)) { const juce::File f (k); if (isProjectHome (f)) return projectIn (f); return isProjectKind (f) ? f : juce::File (f.getFullPathName() + ".sls"); }
    const auto n = juce::File::createLegalFileName (k.isEmpty() ? juce::String ("untitled") : k);
    const auto home = projectsRoot().getChildFile (n), inHome = projectIn (home);
    if (inHome != juce::File()) return inHome;
    const auto now = projectsRoot().getChildFile (n + ".sls"), old = projectsRoot().getChildFile (n + ".slur");
    if (now.exists()) return now;
    if (old.isDirectory()) return old;
    return home.exists() && ! home.getChildFile (AUDIO_FILES).isDirectory() ? now : home.getChildFile (n + ".sls");      // a new one: in a folder of its own (unless a person's folder of that name is there already)
}
/** What the page calls the project that lies here. */
juce::String projectKey (const juce::File& dir)
{
    const auto h = projectHome (dir), at = h != juce::File() ? h : dir;
    const bool bare = at.getParentDirectory() == projectsRoot() && (h == juce::File() || h.getFileName() == dir.getFileNameWithoutExtension());      // (its folder renamed: known by where it lies)
    return bare ? dir.getFileNameWithoutExtension() : dir.getFullPathName();
}
/** What is the project's to move, copy, rename or put away: its folder when it has one, else the project itself */
juce::File projectWhole (const juce::File& dir) { const auto h = projectHome (dir); return h != juce::File() ? h : dir; }
/** The project a file handed to the app stands for, when it is one of ours — wherever on the disk it lies. */
juce::String projectNamed (const juce::String& path)
{
    const juce::File f (path.unquoted().trim());
    if (! isProjectKind (f) || ! f.isDirectory()) return {};
    return projectKey (f);
}
/** A place inside a project is no place for another one. */
bool insideAProject (const juce::File& f)
{
    for (auto p = f.getParentDirectory(); ! p.isRoot(); p = p.getParentDirectory()) if (isProjectKind (p) || isProjectHome (p)) return true;
    return false;
}
juce::int64 bytesIn (const juce::File& dir)
{
    juce::int64 n = 0;
    for (const auto& e : juce::RangedDirectoryIterator (dir, true, "*", juce::File::findFiles)) n += e.getFileSize();
    return n;
}
juce::var whyNot (const char* why) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("why", why); return juce::var (o); }
/** The theme maker: this program installed a second time, under its own name (build.sh writes SlurSurface = maker into
    that copy's Info.plist; his ask, 2026-10-24: "내 애플리케이션에 … 뜨게끔"). It opens the room's page laid out by hand
    (ui/maker.js) on the song the app is born with, keeps its own settings and its own mark of a run, opens no project and
    writes none; a theme it keeps goes into the room's settings (op lookKeepRoom). */
/** The page's own address, ending in its folder's slash (the root already has one: a second makes every file the page asks
    for "//name", which is not there) */
juce::String pageRoot() { auto r = juce::WebBrowserComponent::getResourceProviderRoot(); return r.endsWithChar ('/') ? r : r + "/"; }
bool makerApp()
{
    static const bool on = []
    {
        const auto xml = juce::parseXML (juce::File::getSpecialLocation (juce::File::currentApplicationFile).getChildFile ("Contents/Info.plist"));
        if (xml == nullptr) return false;
        if (auto* dict = xml->getChildByName ("dict"))
            for (auto* k = dict->getFirstChildElement(); k != nullptr; k = k->getNextElement())
                if (k->hasTagName ("key") && k->getAllSubText() == "SlurSurface") { auto* v = k->getNextElement(); return v != nullptr && v->getAllSubText() == "maker"; }
        return false;
    }();
    return on;
}
/** The room's own settings, wherever this copy keeps its own (the check's own, in a check) */
juce::File roomPrefsFile()
{
    if (selfTestMode().isNotEmpty()) return daw::musicRoot().getChildFile ("State").getChildFile ("settings.json");
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory).getChildFile ("Application Support").getChildFile (daw::folderName()).getChildFile ("settings.json");
}
juce::File prefsFile()
{
    if (makerApp()) return roomPrefsFile().getParentDirectory().getSiblingFile (juce::String (daw::folderName()) + " Theme Maker").getChildFile ("settings.json");      // (the maker's own: its device, its window, the mark of its run)
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory).getChildFile ("Application Support").getChildFile (daw::folderName()).getChildFile ("settings.json");
}
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
/** A song's whole text, as it is handed to the page: in base64. The library escapes what it hands over by replacing in
    the string one backslash at a time, each time making the string anew — a song of two megabytes, written as a string
    inside the answer (a backslash before each of its quotes), stood the window still for over a minute before it was
    drawn (his project of sixty tracks, 2026-10-19). Base64 has nothing to escape. The page reads it with natText. */
juce::String text64 (const juce::File& f)
{
    juce::MemoryBlock mb;
    return f.loadFileAsData (mb) ? juce::Base64::toBase64 (mb.getData(), mb.getSize()) : juce::String();
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
        if (! test) { const auto prefs = juce::JSON::parse (prefsFile()); if (prefs["hands"].isInt() && (int) prefs["hands"] >= 0) engine.setHands ((int) prefs["hands"]); }      // how many threads were asked for in the settings
        if (! test) { const auto prefs = juce::JSON::parse (prefsFile()); if (prefs["llm"].isInt() && (int) prefs["llm"] > 0) engine.lowLatMs.store (juce::jlimit (1, 100, (int) prefs["llm"])); }      // low latency mode's limit, as it was set (the mode itself begins off)
        if (! test && ! makerApp()) engine.openKeys();                 // every keyboard the machine has is listened to (the check plays its own keys; the theme maker plays none)
        {
            /* audio units opened by the app itself, not through the library: only where asked for (see Engine::ownAu) */
            const auto args = juce::JUCEApplicationBase::getCommandLineParameters();
            const auto prefs = test ? juce::var() : juce::JSON::parse (prefsFile());
            engine.ownAu   = args.contains ("--own-au")   || (prefs["ownAu"].isBool()   && (bool) prefs["ownAu"]);
            engine.auApart = args.contains ("--au-apart") || (prefs["auApart"].isBool() && (bool) prefs["auApart"]);
            if (engine.ownAu) daw::logLine (juce::String ("audio units: the app's own host") + (engine.auApart ? ", each in a process of its own" : ""));
        }
        slur::PlugWindow::key = [this] (const std::string& code, bool shift)
        {
            if (web == nullptr) return false;
            auto* o = new juce::DynamicObject(); o->setProperty ("code", juce::String (code)); o->setProperty ("shift", shift);
            web->emitEventIfBrowserIsVisible ("dawPlugKey", juce::var (o));
            return true;
        };
        engine.onRateChanged = [this] { auto* o = new juce::DynamicObject(); o->setProperty ("sr", engine.sr); if (web) web->emitEventIfBrowserIsVisible ("dawRate", juce::var (o)); };
        engine.onTakeStalled = [this] (bool rate) { auto* o = new juce::DynamicObject(); o->setProperty ("rate", rate); if (web) web->emitEventIfBrowserIsVisible ("dawTakeStalled", juce::var (o)); };
        engine.onSoundCut = [this] (const juce::String& name, double held, double whole, bool disk) { auto* o = new juce::DynamicObject(); o->setProperty ("name", name); o->setProperty ("held", held); o->setProperty ("whole", whole); o->setProperty ("disk", disk); if (web) web->emitEventIfBrowserIsVisible ("dawCut", juce::var (o)); };
        if (! test && juce::JSON::parse (prefsFile())["lang"].toString() == "ko") lang = "ko";      // the language of the settings (general); the check speaks english unless it says otherwise
        web = std::make_unique<juce::WebBrowserComponent> (
            juce::WebBrowserComponent::Options{}
                .withNativeIntegrationEnabled()
                .withKeepPageLoadedWhenBrowserIsHidden()
                .withUserScript ("window.__LANG = '" + lang + "';")           // known to the page before it draws a word (ui/lang.js)
                .withResourceProvider ([] (const juce::String& path) { return serve (path); })
                .withNativeFunction ("daw", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion done)
                {
                    handle (args.size() > 0 ? args[0].toString() : juce::String(), args.size() > 1 ? args[1] : juce::var(), std::move (done));
                }));
        addAndMakeVisible (*web);
        web->goToURL (pageRoot() + (makerApp() ? "?maker=1&alone=1" : ""));      // (the theme maker opens on the room laid out by hand)
        setSize (1440, 900);
        startTimerHz (30);
    }

    ~MainComponent() override { decodeAlive->store (false); decodePool.removeAllJobs (false, 0); slur::PlugWindow::key = nullptr; meters.clear(); settings.reset(); engine.devices().removeChangeListener (this); }
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
    void menuPicked (const juce::String& id)
    {
        if (id == "settings") { showSettings ({}); return; }           // a window of its own, whatever the room is showing
        if (id.startsWith ("settings:")) { showSettings (id.fromFirstOccurrenceOf (":", false, false)); return; }      // (on one of its parts)
        if (id == "guide") { openGuide(); return; }
        auto* o = new juce::DynamicObject(); o->setProperty ("id", id); web->emitEventIfBrowserIsVisible ("dawMenu", juce::var (o));
    }
    /** Help > Slur Studio Help: the user guide (Daw/guide), in the language the program speaks, opened as the Mac opens a PDF.
        It travels inside the app (build.sh puts it in Resources/Guide); a build without it says so at the foot. */
    /** settings > key commands' files: sets of keys kept as .sska files in Slur Studio/Key Commands, and the sets other
        programs keep (Logic's preferences and its .logikcs files, Cubase's Key Commands.xml and its presets, Pro Tools'
        keyboard shortcut presets), read whole for the page to turn into Slur's keys (ui/keyimport.js). */
    static juce::File keysFolder() { return daw::musicRoot().getChildFile ("Key Commands"); }
    static juce::Array<juce::var> keysForeignFound()
    {
        juce::Array<juce::var> out;
        const auto home = juce::File::getSpecialLocation (juce::File::userHomeDirectory);
        auto add = [&out] (const juce::String& daw, const juce::String& name, const juce::File& f) { if (! f.existsAsFile() || f.getSize() > (8 << 20)) return; auto* o = new juce::DynamicObject(); o->setProperty ("daw", daw); o->setProperty ("name", name); o->setProperty ("path", f.getFullPathName()); o->setProperty ("modified", (double) f.getLastModificationTime().toMilliseconds()); out.add (juce::var (o)); };
        add ("logic", "the set in use", home.getChildFile ("Library/Preferences/com.apple.logic10.plist"));
        if (selfTestMode().isEmpty())                                          // (the check stays out of the folders the Mac asks about: its window would wait for an answer)
            for (auto& f : home.getChildFile ("Music/Audio Music Apps/Key Commands").findChildFiles (juce::File::findFiles, false, "*.logikcs")) add ("logic", f.getFileNameWithoutExtension(), f);
        for (auto& dir : home.getChildFile ("Library/Preferences").findChildFiles (juce::File::findDirectories, false, "Cubase*"))
        {
            add ("cubase", dir.getFileName() + ", the set in use", dir.getChildFile ("Key Commands.xml"));
            for (auto& f : dir.getChildFile ("Presets/KeyCommands").findChildFiles (juce::File::findFiles, false, "*.xml")) add ("cubase", dir.getFileName() + ", " + f.getFileNameWithoutExtension(), f);
        }
        add ("protools", "the set in use", home.getChildFile ("Library/Preferences/Avid/Pro Tools/PTCustomHotkeys.txt"));      // (its presets are in Documents, which the Mac asks before it is read: those are opened as a file)
        return out;
    }
    static juce::var keysFileVar (const juce::File& f)
    {
        juce::MemoryBlock mb;
        if (! f.existsAsFile() || f.getSize() > (8 << 20) || ! f.loadFileAsData (mb)) return okVar (false);
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", true); o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("ext", f.getFileExtension().toLowerCase()); o->setProperty ("b64", juce::Base64::toBase64 (mb.getData(), mb.getSize()));
        return juce::var (o);
    }
    void keysFiles (const juce::String& op, const juce::var& d, juce::WebBrowserComponent::NativeFunctionCompletion done)
    {
        if (op == "keysList")                                                  // the sets kept in the folder, read whole
        {
            juce::Array<juce::var> out;
            for (auto& f : keysFolder().findChildFiles (juce::File::findFiles, false, "*.sska"))
                if (f.getSize() < (1 << 20)) { auto* o = new juce::DynamicObject(); o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("json", f.loadFileAsString()); out.add (juce::var (o)); }
            done (juce::var (out)); return;
        }
        if (op == "keysFind") { done (juce::var (keysForeignFound())); return; }
        if (op == "keysRead")                                                  // one of those found (only those)
        {
            const auto path = d["path"].toString();
            for (auto& v : keysForeignFound()) if (v["path"].toString() == path) { done (keysFileVar (juce::File (path))); return; }
            done (okVar (false)); return;
        }
        if (selfTestMode().isNotEmpty()) { done (okVar (false)); return; }   // (the check opens no window of the Mac's)
        keysFolder().createDirectory();
        if (op == "keysExport")
        {
            const auto json = d["json"].toString(), name = juce::File::createLegalFileName (d["name"].toString().isNotEmpty() ? d["name"].toString() : juce::String ("my keys"));
            chooser = std::make_unique<juce::FileChooser> ("Export Key Commands", keysFolder().getChildFile (name + ".sska"), "*.sska");
            chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting, [done, json] (const juce::FileChooser& fc)
            {
                auto f = fc.getResult();
                if (f == juce::File()) { done (okVar (false)); return; }
                if (! f.hasFileExtension ("sska")) f = f.withFileExtension ("sska");
                auto* o = new juce::DynamicObject(); o->setProperty ("ok", f.replaceWithText (json)); o->setProperty ("name", f.getFileNameWithoutExtension());
                done (juce::var (o));
            });
            return;
        }
        const bool foreign = op == "keysForeign";
        chooser = std::make_unique<juce::FileChooser> (foreign ? "Keys of Another Program" : "Import Key Commands", foreign ? juce::File::getSpecialLocation (juce::File::userHomeDirectory) : keysFolder(), foreign ? "*.logikcs;*.plist;*.xml;*.ptpreset;*.txt" : "*.sska");
        chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles, [done] (const juce::FileChooser& fc) { done (keysFileVar (fc.getResult())); });
    }
    void openGuide()
    {
        const auto dir = juce::File::getSpecialLocation (juce::File::currentApplicationFile).getChildFile ("Contents/Resources/Guide");
        auto f = dir.getChildFile (lang == "ko" ? juce::String (juce::CharPointer_UTF8 ("Slur Studio \xec\x82\xac\xec\x9a\xa9 \xec\x84\xa4\xeb\xaa\x85\xec\x84\x9c.pdf")) : juce::String ("Slur Studio User Guide.pdf"));
        if (! f.existsAsFile()) f = dir.getChildFile ("Slur Studio User Guide.pdf");
        if (f.existsAsFile() && selfTestMode().isEmpty()) { f.startAsProcess(); return; }
        auto* o = new juce::DynamicObject(); o->setProperty ("id", "guideMissing"); web->emitEventIfBrowserIsVisible ("dawMenu", juce::var (o));
    }
    /** The settings window, brought forward (made the first time); `part`: on that part, else where it was left. */
    void showSettings (const juce::String& part)
    {
        if (settings == nullptr)
            settings = std::make_unique<SettingsWindow> ([] (const juce::String& path) { return serve (path); },
                                                         [this] (const juce::String& op, const juce::var& d, SettingsWindow::Done done) { handle (op, d, std::move (done)); },
                                                         part.isNotEmpty() ? part : juce::String ("audio"), lang);
        else settings->show (part);
    }
    /** A project was handed to the app (opened from the Finder): the page opens it, now or as soon as it is up. */
    void openProject (const juce::String& name)
    {
        if (name.isEmpty()) return;
        if (! pageUp) { pendingOpen = name; return; }
        auto* o = new juce::DynamicObject(); o->setProperty ("name", name);
        web->emitEventIfBrowserIsVisible ("dawOpen", juce::var (o));
    }
    /** Let the page save first; quit anyway after a second and a half — unless the page answers that it is asking (quitWait). */
    void askToQuit() { if (quitIn > 0) return; quitIn = 45; web->emitEventIfBrowserIsVisible ("dawQuit", juce::var()); }
    void snapshot (const juce::File& f, bool slursOwn = false) { if (auto* p = getPeer()) slurSnapshotWebView (p->getNativeHandle(), f.getFullPathName().toRawUTF8(), slursOwn); }
    daw::Engine engine;
    /** Sounds made ready (decoded into the cache the first time, and brought to the engine's rate) several at a time and
        off the message thread: a project of many takes opens in a share of the time, and the window goes on moving while it
        does (his ask, 2026-10-18: opening took too long). After the engine, so it goes first; what it hands back after the
        window has gone is dropped. */
    std::shared_ptr<std::atomic<bool>> decodeAlive = std::make_shared<std::atomic<bool>> (true);
    juce::ThreadPool decodePool { juce::jlimit (2, 8, juce::SystemStats::getNumCpus() - 2) };
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
        if (op == "wall")    { done (engine.setWall (d)); return; }                                   // a track's patch as a wall: prints and plug-ins in one graph
        if (op == "wallAmt") { engine.setWallAmount ((int) d["track"], (int) d["id"], (float) (double) d["v"]); done (okVar()); return; }
        if (op == "wallFacts") { done (engine.wallFacts ((int) d["track"])); return; }
        if (op == "hello")
        {
            if (! keysToPage && getPeer() != nullptr) keysToPage = slurKeysToPage (getPeer()->getNativeHandle());      // (the page is up: command x, c, v and a are its keys from here on)
            if (! dropsKnown && getPeer() != nullptr) dropsKnown = slurDropsKnown (getPeer()->getNativeHandle());      // (and where a file let go on it lies is kept: op dropPaths)
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", true); o->setProperty ("sr", engine.sr);
            o->setProperty ("mp3", engine.lame.existsAsFile()); o->setProperty ("lame", engine.lame.getFullPathName()); o->setProperty ("mic", slurMicStatus()); o->setProperty ("ins", engine.inputCount());
            o->setProperty ("selftest", selfTestMode());
            o->setProperty ("alone", makerApp());                    // (the theme maker: no project is opened, none written)
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
        if (op == "ref")     { engine.setRef (d["key"].toString(), (double) d["start"], (float) (double) d["vol"], (int) d["on"] != 0, d["pieces"]); done (okVar()); return; }      // the reference row (ui/reference.js): its pieces, edited as a track's regions
        if (op == "seek")    { engine.seek ((double) d["bar"]); done (okVar()); return; }
        if (op == "queue")   { engine.queued.store ((double) d["bar"]); done (okVar()); return; }
        if (op == "loop")    { engine.loopA.store ((double) d["a"]); engine.loopB.store ((double) d["b"]); engine.loop.store ((int) d["on"] != 0); done (okVar()); return; }
        if (op == "audioSettings") { showSettings ("audio"); done (okVar()); return; }      // (the room's own ways to the device: the same window, on its audio part)
        if (op == "settings")      { showSettings (d["part"].toString()); done (okVar()); return; }
        if (op == "maker")                                             // the theme maker: the app of its own beside this one (build.sh), else the room's page laid out by hand in place (ui/maker.js), and back
        {
            const auto app = juce::File::getSpecialLocation (juce::File::currentApplicationFile).getSiblingFile (juce::String (daw::folderName()) + " Theme Maker.app");
            if ((int) d["on"] != 0 && ! makerApp() && selfTestMode().isEmpty() && app.isDirectory()) { done (okVar (app.startAsProcess())); return; }
            web->goToURL (pageRoot() + ((int) d["on"] != 0 ? "?maker=1" : "")); done (okVar()); return;
        }
        if (op == "lookKeepRoom")                                      // a theme the theme maker keeps: into the room's own list (settings > display), by its name
        {
            const auto name = d["name"].toString().trim().substring (0, 40);
            if (name.isEmpty() || ! d["look"].isObject()) { done (okVar (false)); return; }
            auto v = juce::JSON::parse (roomPrefsFile());
            if (! v.isObject()) v = juce::var (new juce::DynamicObject());
            auto looks = v["looks"].isObject() ? v["looks"] : juce::var (new juce::DynamicObject());
            looks.getDynamicObject()->setProperty (name, d["look"]);
            v.getDynamicObject()->setProperty ("looks", looks);
            roomPrefsFile().getParentDirectory().createDirectory();
            done (okVar (roomPrefsFile().replaceWithText (juce::JSON::toString (v)))); return;
        }
        if (op == "settingsClose") { if (settings != nullptr) settings->setVisible (false); done (okVar()); return; }
        if (op == "settingsRead")  { done (settingsNow()); return; }
        if (op == "lowLatency")    { done (engine.setLowLatency ((int) d["on"] != 0, (int) d["ms"])); return; }      // the transport's bolt: what is heard live goes without what is too late (Engine::lowLatency)
        if (op == "lowLatFacts")   { done (engine.setLowLatency (engine.lowLat.load(), 0)); return; }      // (looked at again first: what is armed and listened to may have changed)
        if (op == "settingsSet")   { done (settingsSet (d)); return; }
        if (op == "settingsSize")  { if (settings != nullptr) settings->sizeTo ((int) d["w"], (int) d["h"]); done (okVar()); return; }      // (display asks for a larger window than the other parts)
        if (op == "slurLook")                                                  // slur's panel turns light when the room's ground has grown light (ui/look.js), and dark again
        {
            slurLight = (int) d["light"] != 0;
            if (slur != nullptr) slur->evaluateJavascript (juce::String ("window.__slurLook && window.__slurLook('") + (slurLight ? "light" : "dark") + "')");
            done (okVar()); return;
        }
        if (op == "keysCatalog")                                               // the room's commands (ui/commands.js), kept here for the settings window (ui/keypage.js)
        {
            if (d.hasProperty ("list")) { keysCatalog = d["list"]; done (okVar()); return; }
            done (keysCatalog.isArray() ? keysCatalog : juce::var (juce::Array<juce::var>())); return;
        }
        if (op == "menuPick") { menuPicked (d["id"].toString()); done (okVar()); return; }      // a line the page runs as the menu bar would (settings' parts, the guide)
        if (op == "keysList" || op == "keysExport" || op == "keysImport" || op == "keysFind" || op == "keysForeign" || op == "keysRead") { keysFiles (op, d, std::move (done)); return; }
        if (op == "lookShare")                                                 // a look written to a file of its own, to be handed to someone (ui/settings.js)
        {
            const auto json = d["json"].toString(), name = juce::File::createLegalFileName (d["name"].toString().isNotEmpty() ? d["name"].toString() : juce::String ("my theme"));
            if (selfTestMode().isNotEmpty()) { done (okVar (false)); return; }
            const auto themes = daw::musicRoot().getChildFile ("Themes"); themes.createDirectory();      // (a theme is a .sst file: Slur Studio theme)
            chooser = std::make_unique<juce::FileChooser> ("Share Theme", themes.getChildFile (name + ".sst"), "*.sst");
            chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting, [done, json] (const juce::FileChooser& fc)
            {
                auto f = fc.getResult();
                if (f == juce::File()) { done (okVar (false)); return; }
                if (! f.hasFileExtension ("sst")) f = f.withFileExtension ("sst");
                done (okVar (f.replaceWithText (json)));
            });
            return;
        }
        if (op == "lookOpen")                                                  // a look someone handed over: its name and what is in it
        {
            if (selfTestMode().isNotEmpty()) { done (okVar (false)); return; }
            const auto themes = daw::musicRoot().getChildFile ("Themes"); themes.createDirectory();
            chooser = std::make_unique<juce::FileChooser> ("Open Theme", themes, "*.sst;*.slurlook");      // (a look written before themes were: the same values)
            chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles, [done] (const juce::FileChooser& fc)
            {
                const auto f = fc.getResult();
                if (f == juce::File() || ! f.existsAsFile()) { done (okVar (false)); return; }
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", true); o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("json", f.loadFileAsString());
                done (juce::var (o));
            });
            return;
        }
        if (op == "settingsTone")  { if (selfTestMode().isEmpty() && ! engine.busy()) engine.devices().playTestSound(); done (okVar()); return; }      // (the check is silent)
        if (op == "testSettings")                                              // the check: the window as it stands, and a picture of its page
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("open", settings != nullptr && settings->isVisible());
            if (settings != nullptr)
            {
                o->setProperty ("title", settings->getName()); o->setProperty ("w", settings->page().getWidth()); o->setProperty ("h", settings->page().getHeight());
                if (auto* p = settings->getPeer()) if (d["name"].toString().isNotEmpty()) slurSnapshotWebView (p->getNativeHandle(), logDir().getChildFile (juce::File::createLegalFileName (d["name"].toString())).getFullPathName().toRawUTF8(), false);
            }
            done (juce::var (o)); return;
        }
        if (op == "testSettingsJs")                                            // the check: a script run in the settings page (what it holds; a press made by its own code)
        {
            if (selfTestMode().isEmpty() || settings == nullptr) { done (juce::var()); return; }
            settings->page().evaluateJavascript (d["js"].toString(), [done] (juce::WebBrowserComponent::EvaluationResult r) { done (r.getResult() != nullptr ? juce::JSON::parse (r.getResult()->toString()) : juce::var()); });
            return;
        }
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
            o->setProperty ("dir", audioDirOf (projectDir (d["project"].toString())).getFullPathName());
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
        if (op == "levels") { engine.findLevels (d["key"].toString(), [done] (juce::var r) { done (r); }); return; }      // how loud a buffer is along its length, for ui/silence.js: {key}
        if (op == "zeroCross") { done (engine.zeroCross (d["key"].toString(), d["at"], d.hasProperty ("within") ? (double) d["within"] : 0.01)); return; }      // edges onto zero: {key, at: [[s, dir] …], within}
        if (op == "dropBuffer") { engine.dropBuffer (d["key"].toString()); done (okVar()); return; }
        if (op == "wave") { done (engine.wave (d["key"].toString(), (double) d["from"], (double) d["to"], (int) d["n"])); return; }      // a stretch of a sound, close up, for drawing
        if (op == "pcm") { done (engine.pcm (d["key"].toString(), (double) d["from"], (double) d["sec"])); return; }      // a stretch of a sound as it is, for the page to hear what it is (ui/tidy.js)
        if (op == "closeEditors") { engine.closeEditors(); done (okVar()); return; }
        if (op == "testPlugWindows") { done (juce::JSON::parse (juce::String (slur::PlugWindow::check ((bool) d["space"], d.hasProperty ("code") ? (int) d["code"] : 49, (int) d["post"] != 0)))); return; }      // (for the self-test)
        if (op == "plugins") { done (engine.listPlugins ([] (const juce::String& id) { return auMaker (id); })); return; }
        if (op == "insert")  { engine.insertPlugin ((int) d["track"], d["id"].toString(), d["state"].toString(), ! d.hasProperty ("show") || (int) d["show"] != 0, [done] (juce::var r) { done (r); }, d.hasProperty ("at") ? (int) d["at"] : -1, (int) d["inst"] != 0); return; }
        // a track's instrument: one of the DAW's own ({track, kind, p}), what is turned on it ({track, p}), a sound for it to play from ({track, slot, key})
        if (op == "inst")       { done (engine.setInstrument ((int) d["track"], d["kind"].toString(), d["p"])); return; }
        if (op == "instSet")    { done (okVar (engine.instrumentParams ((int) d["track"], d["p"]))); return; }
        if (op == "instSample") { done (okVar (engine.instrumentSample ((int) d["track"], (int) d["slot"], d["key"].toString()))); return; }
        if (op == "key")        { engine.playKey ((int) d["st"], (int) d["d1"], (int) d["d2"]); done (okVar()); return; }      // a key played from the page
        if (op == "keyInputs")  { done (engine.keyInputs()); return; }
        if (op == "hush")       { engine.hushAll(); done (okVar()); return; }                                                      // every instrument silent at once
        if (op == "capture")    { done (engine.capture()); return; }                                                           // what was just played, though nothing was recording
        if (op == "pluginStates") { done (engine.pluginStates ((int) d["moved"] != 0)); return; }
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
            juce::Array<juce::File> top;
            for (auto* pattern : { "*.sls", "*.slur" }) top.addArray (projectsRoot().findChildFiles (juce::File::findDirectories, false, pattern));
            for (auto& h : projectsRoot().findChildFiles (juce::File::findDirectories, false, "*")) if (isProjectHome (h)) top.add (projectIn (h));      // (one in a folder of its own)
            for (auto& f : top)
                    if (f.getChildFile ("project.json").existsAsFile() && ! seen.contains (projectKey (f)))
                    {
                        seen.add (projectKey (f));                                     // (a copy in a renamed folder beside the one it was copied from is a project of its own)
                        const auto h = projectHome (f);
                        auto* o = new juce::DynamicObject();
                        o->setProperty ("name", h != juce::File() ? h.getFileName() : f.getFileNameWithoutExtension()); o->setProperty ("key", projectKey (f));
                        o->setProperty ("modified", f.getChildFile ("project.json").getLastModificationTime().toMilliseconds());
                        out.add (juce::var (o));
                    }
            juce::StringArray inFolders;                                       // the ones in a folder a person made among the projects (one level deep): by their whole path, with the folder's name
            for (auto& folder : projectsRoot().findChildFiles (juce::File::findDirectories, false, "*"))
                if (! isProjectKind (folder) && ! isProjectHome (folder) && ! folder.getFileName().startsWithChar ('.'))
                {
                    juce::Array<juce::File> in;
                    for (auto* pattern : { "*.sls", "*.slur" }) in.addArray (folder.findChildFiles (juce::File::findDirectories, false, pattern));
                    for (auto& h : folder.findChildFiles (juce::File::findDirectories, false, "*")) if (isProjectHome (h)) in.add (projectIn (h));
                    for (auto& f : in)
                            if (f.getChildFile ("project.json").existsAsFile())
                            {
                                auto* o = new juce::DynamicObject();
                                o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("key", f.getFullPathName());
                                o->setProperty ("dir", folder.getFileName());
                                o->setProperty ("modified", f.getChildFile ("project.json").getLastModificationTime().toMilliseconds());
                                out.add (juce::var (o)); inFolders.add (f.getFullPathName());
                            }
                }
            if (auto* also = d["also"].getArray())                             // the ones kept somewhere else that the page remembers, while they are still there
                for (auto& k : *also)
                {
                    const auto f = projectDir (k.toString());
                    if (! juce::File::isAbsolutePath (k.toString()) || projectKey (f) != k.toString() || ! f.getChildFile ("project.json").existsAsFile() || inFolders.contains (f.getFullPathName())) continue;
                    auto* o = new juce::DynamicObject();
                    o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("key", k.toString());
                    o->setProperty ("in", projectWhole (f).getParentDirectory().getFileName());
                    o->setProperty ("modified", f.getChildFile ("project.json").getLastModificationTime().toMilliseconds());
                    out.add (juce::var (o));
                }
            done (out); return;
        }
        /* folders among the projects: plain folders in the projects' place, one level deep (a folder holds projects, not folders) */
        if (op == "projFolders")
        {
            juce::Array<juce::var> out;
            for (auto& f : projectsRoot().findChildFiles (juce::File::findDirectories, false, "*"))
                if (! isProjectKind (f) && ! isProjectHome (f) && ! f.getFileName().startsWithChar ('.'))
                { auto* o = new juce::DynamicObject(); o->setProperty ("name", f.getFileName()); out.add (juce::var (o)); }
            done (out); return;
        }
        if (op == "folderNew")
        {
            const auto name = juce::File::createLegalFileName (d["name"].toString().trim());
            const auto f = projectsRoot().getChildFile (name);
            if (name.isEmpty() || name.startsWithChar ('.') || isProjectKind (f)) { done (whyNot ("that is no name for a folder")); return; }
            if (f.exists()) { done (whyNot ("there is one of that name")); return; }
            auto* o = new juce::DynamicObject(); o->setProperty ("ok", f.createDirectory().wasOk()); o->setProperty ("name", name);
            done (juce::var (o)); return;
        }
        if (op == "folderDrop")                                                // an empty folder is taken away; one that holds anything is left as it is
        {
            const auto f = projectsRoot().getChildFile (juce::File::createLegalFileName (d["name"].toString().trim()));
            if (! f.isDirectory() || isProjectKind (f) || isProjectHome (f) || f.getParentDirectory() != projectsRoot()) { done (whyNot ("no such folder")); return; }
            for (auto& c : f.findChildFiles (juce::File::findFilesAndDirectories, false, "*")) if (c.getFileName() != ".DS_Store") { done (whyNot ("the folder is not empty")); return; }
            done (okVar (f.deleteRecursively())); return;
        }
        if (op == "projMove")                                                  // a project put into one of those folders, or taken out again: {name: its key, to: the folder — or nothing} -> {ok, key}
        {
            const auto from = projectDir (d["name"].toString());
            const auto toName = d["to"].toString().trim();
            const auto dest = toName.isEmpty() ? projectsRoot() : projectsRoot().getChildFile (juce::File::createLegalFileName (toName));
            if (! from.isDirectory() || ! isProjectKind (from) || ! from.getChildFile ("project.json").existsAsFile()) { done (whyNot ("no such project")); return; }
            if (! dest.isDirectory() || isProjectKind (dest) || isProjectHome (dest)) { done (whyNot ("no such folder")); return; }
            const auto whole = projectWhole (from);                            // (one in a folder of its own goes with its folder: its sounds and bounces)
            if (! (whole.getParentDirectory() == projectsRoot() || whole.getParentDirectory().getParentDirectory() == projectsRoot())) { done (whyNot ("it is kept somewhere else")); return; }      // (one a person keeps in a place of their own stays there)
            const auto to = dest.getChildFile (whole.getFileName());
            if (to != whole && to.exists()) { done (whyNot ("there is one of that name there")); return; }
            const bool ok = to == whole || whole.moveFileTo (to);
            const auto now = whole == from ? to : to.getChildFile (from.getFileName());
            auto* o = new juce::DynamicObject(); o->setProperty ("ok", ok); o->setProperty ("key", projectKey (ok ? now : from));
            done (juce::var (o)); return;
        }
        if (op == "projSave")
        {
            auto dir = projectDir (d["name"].toString());
            makeHome (dir);
            dir.createDirectory(); audioDirOf (dir).createDirectory();
            keepBackup (dir, dir.getChildFile ("project.json"), (int) d["backup"] != 0);
            daw::Marker::set ("project", d["name"].toString());
            done (okVar (dir.getChildFile ("project.json").replaceWithText (d["json"].toString()))); return;
        }
        if (op == "projLoad")
        {
            auto f = projectDir (d["name"].toString()).getChildFile ("project.json");
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", f.existsAsFile());
            if (f.existsAsFile()) { o->setProperty ("json64", text64 (f)); o->setProperty ("saved", f.getLastModificationTime().toMilliseconds()); daw::Marker::set ("project", d["name"].toString()); }
            done (juce::var (o)); return;
        }
        if (op == "projFacts")                                                 // a project seen from far away, for the start page: its numbers, its weight, and where each track sounds. It is only read: nothing marks it as the open one
        {
            const auto dir = projectDir (d["name"].toString());
            const auto f = dir.getChildFile ("project.json");
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", f.existsAsFile());
            if (! f.existsAsFile())
            {
                const auto path = dir.getFullPathName();                       // kept on a disk that is not connected just now: said, so that the page can keep it in its list
                const auto disk = path.startsWith ("/Volumes/") ? path.substring (9).upToFirstOccurrenceOf ("/", false, false) : juce::String();
                if (disk.isNotEmpty() && ! juce::File ("/Volumes/" + disk).isDirectory()) o->setProperty ("gone", disk);
                done (juce::var (o)); return;
            }
            const auto v = juce::JSON::parse (f);
            juce::int64 bytes = 0;
            for (const auto& e : juce::RangedDirectoryIterator (projectWhole (dir), true, "*", juce::File::findFiles)) bytes += e.getFileSize();
            o->setProperty ("bytes", (double) bytes);
            for (auto* k : { "tempo", "meter", "key" }) o->setProperty (k, v[k]);
            juce::Array<juce::var> tracks;
            if (auto* all = v["tracks"].getArray())
                for (auto& t : *all)
                {
                    auto* q = new juce::DynamicObject();
                    for (auto* k : { "id", "name", "kind", "tone", "col", "parent" }) if (! t[k].isVoid()) q->setProperty (k, t[k]);
                    if (t["inst"].isObject()) q->setProperty ("notes", true);
                    juce::Array<juce::var> regs;                               // where it sounds: begin, end, begin, end… in bars
                    if (auto* rs = t["regs"].getArray()) for (auto& r : *rs) if (! (bool) r["mute"]) { regs.add (r["a"]); regs.add (r["b"]); }
                    q->setProperty ("regs", regs);
                    tracks.add (juce::var (q));
                }
            o->setProperty ("tracks", tracks);
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
            if (f.existsAsFile()) o->setProperty ("json64", text64 (f));
            done (juce::var (o)); return;
        }
        if (op == "takesLeft") { done (engine.takesLeft (audioDirOf (projectDir (d["project"].toString())))); return; }
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
        if (op == "projRename")                                                // a new name where the project lies; always a .sls (projectDir gives the old kind only for a folder that is there)
        {
            const auto from = projectDir (d["from"].toString()), home = projectHome (from);
            const auto name = juce::File::createLegalFileName (d["to"].toString().trim());
            if (home != juce::File())                                          // in a folder of its own: the folder takes the name, and the project in it
            {
                const auto newHome = home.getSiblingFile (name), newDir = newHome.getChildFile (name + ".sls");
                const bool caps = newHome.getFullPathName() != home.getFullPathName() && newHome.getFullPathName().equalsIgnoreCase (home.getFullPathName());
                bool ok = name.isNotEmpty() && (caps || ! newHome.exists());
                if (ok) ok = caps ? std::rename (home.getFullPathName().toRawUTF8(), newHome.getFullPathName().toRawUTF8()) == 0 : home.moveFileTo (newHome);
                if (ok && newHome.getChildFile (from.getFileName()).getFullPathName() != newDir.getFullPathName()) ok = std::rename (newHome.getChildFile (from.getFileName()).getFullPathName().toRawUTF8(), newDir.getFullPathName().toRawUTF8()) == 0;
                auto* o = new juce::DynamicObject(); o->setProperty ("ok", ok); o->setProperty ("key", projectKey (ok ? newDir : from));
                done (juce::var (o)); return;
            }
            const auto to = juce::File::isAbsolutePath (d["from"].toString().trim()) ? from.getSiblingFile (name + ".sls") : projectsRoot().getChildFile (name + ".sls");      // (one from before stays as it is: one file, renamed)
            auto* o = new juce::DynamicObject();
            const bool capsOnly = to.getFullPathName() != from.getFullPathName() && to.getFullPathName().equalsIgnoreCase (from.getFullPathName());      // ("song" to "Song": the disk takes them for one name)
            o->setProperty ("ok", from.isDirectory() ? (capsOnly ? std::rename (from.getFullPathName().toRawUTF8(), to.getFullPathName().toRawUTF8()) == 0 : (! to.exists() && from.moveFileTo (to))) : capsOnly || ! to.exists());
            o->setProperty ("key", projectKey (to));
            done (juce::var (o)); return;
        }
        if (op == "projWhere")                                                 // Save As: the Mac asks where, and under what name (it also asks before one that is there is replaced)
        {
            const auto from = projectDir (d["from"].toString());
            const auto name = juce::File::createLegalFileName (d["name"].toString().trim()) + ".sls";
            const auto answer = [from, done] (juce::File to)
            {
                if (to == juce::File()) { done (okVar (false)); return; }
                if (! isProjectKind (to)) to = juce::File (to.getFullPathName() + ".sls");
                const auto home = to.getParentDirectory().getChildFile (to.getFileNameWithoutExtension());      // (it goes into a folder of its own of that name: the name.sls, Audio Files, Bounces)
                to = home.getChildFile (to.getFileName());
                if (to == from) { done (whyNot ("same")); return; }
                if (insideAProject (home)) { done (whyNot ("inside")); return; }
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", true); o->setProperty ("key", projectKey (to)); o->setProperty ("there", home.exists());
                done (juce::var (o));
            };
            if (selfTestMode().isNotEmpty() && (int) d["panel"] == 0) { answer (daw::musicRoot().getChildFile ("Elsewhere").getNonexistentChildFile (name.upToLastOccurrenceOf (".", false, false), ".sls", false)); return; }      // the check has no hands for a panel: a place of its own, outside where projects are kept
            const auto in = projectWhole (from).getParentDirectory().isDirectory() ? projectWhole (from).getParentDirectory() : projectsRoot();
            if (in == projectsRoot()) in.createDirectory();
            chooser = std::make_unique<juce::FileChooser> ("Save As", in.getChildFile (name), "*.sls");
            chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles, [answer] (const juce::FileChooser& fc) { answer (fc.getResult()); });
            return;
        }
        if (op == "projPick")                                                  // Open: the Mac's own panel, on the folder the open project lies in
        {
            if (selfTestMode().isNotEmpty() && (int) d["panel"] == 0) { done (okVar (false)); return; }
            const auto from = projectDir (d["from"].toString());
            chooser = std::make_unique<juce::FileChooser> ("Open", projectWhole (from).getParentDirectory().isDirectory() ? projectWhole (from).getParentDirectory() : projectsRoot(), "*.sls;*.slur");
            chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::canSelectDirectories, [done] (const juce::FileChooser& fc)      // (a .slur from before is a plain folder to the Finder)
            {
                auto f = fc.getResult();
                if (f == juce::File()) { done (okVar (false)); return; }
                if (isProjectHome (f)) f = projectIn (f);                              // (its folder picked: the project in it)
                if (! isProjectKind (f) || ! f.getChildFile ("project.json").existsAsFile()) { done (whyNot ("not")); return; }
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", true); o->setProperty ("key", projectKey (f));
                done (juce::var (o));
            });
            return;
        }
        if (op == "projCopy")                                                  // the project as it lies on the disk, once more in another place; `replace`: what is there goes to the Trash first
        {
            const auto from = projectDir (d["from"].toString());
            auto to = projectDir (d["to"].toString());
            const bool own = to.getParentDirectory().getFileName() == to.getFileNameWithoutExtension() && to.getParentDirectory() != projectsRoot();      // (it goes into a folder of its own)
            const auto whole = own ? to.getParentDirectory() : to, was = projectWhole (from), fromSounds = audioDirOf (from);
            if (to == from || whole == was || whole.isAChildOf (was)) { done (whyNot ("same")); return; }
            if (insideAProject (whole)) { done (whyNot ("inside")); return; }
            if (whole.exists() && (int) d["replace"] == 0) { done (whyNot ("taken")); return; }
            const auto in = whole.getParentDirectory();
            if (! in.createDirectory().wasOk()) { done (whyNot ("write")); return; }
            if (from.isDirectory() && bytesIn (was) + 64 * 1048576 > in.getBytesFreeOnVolume()) { done (whyNot ("room")); return; }
            if (whole.exists() && ! whole.moveToTrash()) { done (whyNot ("write")); return; }
            bool ok = true;
            if (own)
            {
                ok = whole.getChildFile (AUDIO_FILES).createDirectory().wasOk() && whole.getChildFile (BOUNCES).createDirectory().wasOk() && to.createDirectory().wasOk();
                if (ok && from.isDirectory())                                  // the project (its file and backups), and its sounds into Audio Files
                    for (auto& c : from.findChildFiles (juce::File::findFilesAndDirectories, false, "*"))
                        if (c.getFileName() != "audio" && ok) ok = c.isDirectory() ? c.copyDirectoryTo (to.getChildFile (c.getFileName())) : c.copyFileTo (to.getChildFile (c.getFileName()));
                if (ok && fromSounds.isDirectory()) ok = fromSounds.copyDirectoryTo (whole.getChildFile (AUDIO_FILES));
                if (ok && (int) d["move"] != 0 && bouncesDirOf (from).isDirectory()) ok = bouncesDirOf (from).copyDirectoryTo (whole.getChildFile (BOUNCES));      // (moved: what it had printed goes along)
                if (ok) slurProjectIcon (whole.getFullPathName().toRawUTF8());
            }
            else ok = from.isDirectory() ? from.copyDirectoryTo (to) : to.getChildFile ("audio").createDirectory().wasOk();
            if (! ok) { whole.deleteRecursively(); done (whyNot ("write")); return; }     // half a copy is no project: only what was just laid there is taken away
            /* `move`: the project is from now on the one just laid there, and what it was kept as goes (a song that was never
               given a name, saved for the first time: "untitled" does not stay behind beside it). To the Trash, not away. */
            if ((int) d["move"] != 0 && from.isDirectory()) { if (selfTestMode().isNotEmpty()) was.deleteRecursively(); else was.moveToTrash(); }
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", true); o->setProperty ("key", projectKey (to));
            done (juce::var (o)); return;
        }
        /* a patch kept as a preset: the files Patch on Slur keeps (<name>.orbpatch, in its own folder), so a patch kept in one
           is there in the other. The check keeps them in a place of its own, and has no hands for a panel. */
        if (op.startsWith ("preset") && op != "patchPreset")
        {
            const bool test = selfTestMode().isNotEmpty();
            const auto dir = test ? daw::musicRoot().getChildFile ("Presets")
                                  : juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory).getChildFile ("Orb").getChildFile ("Sounds").getChildFile ("Presets");
            const auto name = juce::File::createLegalFileName (d["name"].toString().trim());
            const auto file = dir.getChildFile (name + ".orbpatch");
            const auto named = [] (const juce::File& f, bool withText)
            {
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", true); o->setProperty ("name", f.getFileNameWithoutExtension());
                if (withText) o->setProperty ("json", f.loadFileAsString());
                return juce::var (o);
            };
            if (op == "presetList")
            {
                juce::Array<juce::var> names; juce::Array<juce::File> files;
                if (dir.isDirectory()) dir.findChildFiles (files, juce::File::findFiles, false, "*.orbpatch");
                files.sort();
                for (auto& f : files) names.add (f.getFileNameWithoutExtension());
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", true); o->setProperty ("names", names);
                done (juce::var (o)); return;
            }
            if (op == "presetSave")   { if (name.isEmpty() || ! dir.createDirectory().wasOk() || ! file.replaceWithText (d["json"].toString())) { done (okVar (false)); return; } done (named (file, false)); return; }
            if (op == "presetLoad")   { if (name.isEmpty() || ! file.existsAsFile()) { done (okVar (false)); return; } done (named (file, true)); return; }
            if (op == "presetDelete") { done (okVar (name.isNotEmpty() && file.existsAsFile() && (test ? file.deleteFile() : file.moveToTrash()))); return; }      // (to the Trash, not away)
            if (op == "presetSaveAs")
            {
                const auto json = d["json"].toString();
                const auto start = dir.getChildFile ((name.isEmpty() ? juce::String ("untitled") : name) + ".orbpatch");
                dir.createDirectory();
                if (test && (int) d["panel"] == 0) { const bool ok = start.replaceWithText (json); done (ok ? named (start, false) : okVar (false)); return; }
                chooser = std::make_unique<juce::FileChooser> ("save preset as", start, "*.orbpatch");
                chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting, [done, json, named] (const juce::FileChooser& fc)
                {
                    auto f = fc.getResult();
                    if (f == juce::File()) { done (okVar (false)); return; }
                    if (! f.hasFileExtension ("orbpatch")) f = f.withFileExtension ("orbpatch");
                    done (f.replaceWithText (json) ? named (f, false) : okVar (false));
                });
                return;
            }
            if (op == "presetOpen")
            {
                if (test && (int) d["panel"] == 0) { done (name.isNotEmpty() && file.existsAsFile() ? named (file, true) : okVar (false)); return; }
                dir.createDirectory();
                chooser = std::make_unique<juce::FileChooser> ("open preset", dir, "*.orbpatch");
                chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles, [done, named] (const juce::FileChooser& fc)
                {
                    const auto f = fc.getResult();
                    done (f != juce::File() && f.existsAsFile() ? named (f, true) : okVar (false));
                });
                return;
            }
        }
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
        if (op == "testMeterMath")                                             // the check: the meter's sums against sound that is known (EBU 3341 and 3342's own cases, and plain ones)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isEmpty()) { done (juce::var (o)); return; }
            const double rate = d.hasProperty ("rate") ? (double) d["rate"] : 48000.0, pi2 = juce::MathConstants<double>::twoPi;
            const int block = 512;
            std::vector<float> L ((size_t) block), R ((size_t) block);
            juce::int64 at = 0;
            // seconds of a sine on both sides: its peak in db, its pitch, the right side's sign, and where in its turn it begins
            auto run = [&] (daw::Meter& m, double seconds, double peakDb, double hz, double right, double phase)
            {
                const double a = peakDb <= -200.0 ? 0.0 : std::pow (10.0, peakDb / 20.0);
                for (juce::int64 left = (juce::int64) std::llround (seconds * rate); left > 0; left -= block)
                {
                    const int n = (int) juce::jmin ((juce::int64) block, left);
                    for (int i = 0; i < n; ++i, ++at) { const float v = (float) (a * std::sin (pi2 * hz * (double) at / rate + phase)); L[(size_t) i] = v; R[(size_t) i] = (float) (v * right); }
                    m.take (L.data(), R.data(), n);
                }
            };
            const auto db = [] (float v) { return v > 1.0e-9f ? 20.0 * std::log10 ((double) v) : -200.0; };
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 20.0, -23.0, 1000.0, 1.0, 0.0);                  // 3341, case 1: a thousand hertz at -23 on both sides reads -23
              o->setProperty ("m23", (double) m.momentary.load()); o->setProperty ("s23", (double) m.shortTerm.load()); o->setProperty ("i23", (double) m.integrated.load()); o->setProperty ("range23", (double) m.range.load());
              o->setProperty ("rms23", db (m.rms[0].load())); o->setProperty ("peak23", db (m.peakHeld[0].load())); o->setProperty ("cor23", (double) m.correlation.load()); o->setProperty ("width23", (double) m.width.load());
              run (m, 20.0, -400.0, 1000.0, 1.0, 0.0); o->setProperty ("i23thenSilence", (double) m.integrated.load()); }      // (silence after it is not counted)
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 10.0, -36.0, 1000.0, 1.0, 0.0); run (m, 60.0, -23.0, 1000.0, 1.0, 0.0); run (m, 10.0, -36.0, 1000.0, 1.0, 0.0);      // 3341, case 3: -36, -23, -36 reads -23 (what is more than ten under goes)
              o->setProperty ("iGated", (double) m.integrated.load()); }
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 20.0, -20.0, 1000.0, 1.0, 0.0); run (m, 20.0, -30.0, 1000.0, 1.0, 0.0);                                         // 3342, case 1: -20 then -30 has a range of 10
              o->setProperty ("range10", (double) m.range.load()); }
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 2.0, 0.0, rate / 4.0, 1.0, juce::MathConstants<double>::pi / 4.0);                                              // a quarter of the rate, begun an eighth of a turn in: its samples stop 3 db under what it reaches
              o->setProperty ("tpSample", db (m.peakHeld[0].load())); o->setProperty ("tp", db (m.truePeak.load())); }
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 3.0, -12.0, 440.0, -1.0, 0.0);                                                                                   // one side the other's opposite
              o->setProperty ("corOpp", (double) m.correlation.load()); o->setProperty ("widthOpp", (double) m.width.load()); o->setProperty ("corLowOpp", (double) m.corLow.load()); }
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 3.0, -12.0, 440.0, 0.5, 0.0);                                                                                    // the right side half as loud: 6 db to the left
              o->setProperty ("balLeft", (double) m.balance.load()); const auto r = m.read (5.0); o->setProperty ("waveChars", r["wave"].toString().length()); o->setProperty ("pairChars", r["pairs"].toString().length()); o->setProperty ("sec", (double) r["sec"]); }
            { daw::Meter m; m.prepare (rate); at = 0; run (m, 1.0, 1.0, 100.0, 1.0, 0.0); o->setProperty ("overs", m.overs.load()); m.reset(); run (m, 0.5, -30.0, 100.0, 1.0, 0.0); o->setProperty ("oversAfterReset", m.overs.load()); o->setProperty ("peakAfterReset", db (m.peakHeld[0].load())); }      // over full scale a hundred times a second, each counted once; and the count begun again
            o->setProperty ("rate", rate);
            done (juce::var (o)); return;
        }
        if (op == "testGate")                                                  // the check: where a printed file first sounds, and where another first sounds from a given frame on (a line that opens a track, against the same print with no line)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isEmpty()) { done (juce::var (o)); return; }
            juce::AudioFormatManager fm; fm.registerBasicFormats();
            const float thr = d.hasProperty ("thr") ? (float) (double) d["thr"] : 0.003f;
            double rate = 0.0;
            auto first = [&fm, thr, &rate] (const juce::String& path, juce::int64 from) -> juce::int64
            {
                if (std::unique_ptr<juce::AudioFormatReader> r { fm.createReaderFor (juce::File (path)) })
                {
                    rate = r->sampleRate;
                    const int n = (int) juce::jmin ((juce::int64) 1440000, r->lengthInSamples);
                    juce::AudioBuffer<float> b ((int) r->numChannels, n);
                    r->read (&b, 0, n, 0, true, true);
                    for (int i = (int) juce::jlimit ((juce::int64) 0, (juce::int64) n, from); i < n; ++i) for (int c = 0; c < b.getNumChannels(); ++c) if (std::abs (b.getSample (c, i)) > thr) return i;
                }
                return -1;
            };
            o->setProperty ("ref", (double) first (d["a"].toString(), (juce::int64) (double) d["from"]));
            o->setProperty ("got", (double) first (d["b"].toString(), 0));
            o->setProperty ("rate", rate);
            done (juce::var (o)); return;
        }
        if (op == "testRatio")                                                 // the check: how loud a print is against the same print dry, window by window (a hand that moves with the song)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isEmpty()) { done (juce::var (o)); return; }
            juce::AudioFormatManager fm; fm.registerBasicFormats();
            std::unique_ptr<juce::AudioFormatReader> ra { fm.createReaderFor (juce::File (d["a"].toString())) }, rb { fm.createReaderFor (juce::File (d["b"].toString())) };
            if (ra == nullptr || rb == nullptr) { done (juce::var (o)); return; }
            const int n = (int) juce::jmin ((juce::int64) 1440000, juce::jmin (ra->lengthInSamples, rb->lengthInSamples)), wins = juce::jlimit (1, 512, (int) d["windows"]);
            juce::AudioBuffer<float> A ((int) ra->numChannels, n), B ((int) rb->numChannels, n);
            ra->read (&A, 0, n, 0, true, true); rb->read (&B, 0, n, 0, true, true);
            juce::Array<juce::var> r;
            std::vector<double> ea ((size_t) wins), eb ((size_t) wins);
            for (int w = 0; w < wins; ++w)
            {
                const int i0 = (int) ((juce::int64) n * w / wins), i1 = (int) ((juce::int64) n * (w + 1) / wins);
                for (int i = i0; i < i1; ++i) for (int c = 0; c < 2; ++c) { const float x = A.getSample (juce::jmin (c, A.getNumChannels() - 1), i), y = B.getSample (juce::jmin (c, B.getNumChannels() - 1), i); ea[(size_t) w] += x * x; eb[(size_t) w] += y * y; }
            }
            const double top = *std::max_element (ea.begin(), ea.end());
            for (int w = 0; w < wins; ++w) r.add (ea[(size_t) w] > top * 0.01 && ea[(size_t) w] > 1.0e-9 ? juce::roundToInt (std::sqrt (eb[(size_t) w] / ea[(size_t) w]) * 1000.0) / 1000.0 : -1.0);   // (a window where the dry print is near silent says nothing: -1)
            o->setProperty ("ratio", r); o->setProperty ("rate", ra->sampleRate); o->setProperty ("seconds", (double) n / ra->sampleRate);
            done (juce::var (o)); return;
        }
        if (op == "testLag")                                                   // the check: by how many samples the second file's sound comes later than the first's (one sound printed after going two ways)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isEmpty()) { done (juce::var (o)); return; }
            juce::AudioFormatManager fm; fm.registerBasicFormats();
            const double from = (double) d.getProperty ("from", 0.0);         // (seconds into both files where the comparing begins)
            auto read = [&fm, from] (const juce::String& path)
            {
                std::vector<float> v;
                if (std::unique_ptr<juce::AudioFormatReader> r { fm.createReaderFor (juce::File (path)) })
                {
                    const juce::int64 at = juce::jlimit ((juce::int64) 0, r->lengthInSamples, (juce::int64) (from * r->sampleRate));
                    const int n = (int) juce::jmin ((juce::int64) 72000, r->lengthInSamples - at);
                    juce::AudioBuffer<float> b ((int) r->numChannels, n);
                    r->read (&b, 0, n, at, true, true);
                    v.resize ((size_t) n);
                    for (int i = 0; i < n; ++i) { float sum = 0.0f; for (int c = 0; c < b.getNumChannels(); ++c) sum += b.getSample (c, i); v[(size_t) i] = sum; }
                }
                return v;
            };
            const auto a = read (d["a"].toString()), b = read (d["b"].toString());
            const int n = (int) juce::jmin (a.size(), b.size()), reach = juce::jmin (8192, n / 2);
            double best = 0.0, ea = 0.0, eb = 0.0; int lag = 0;
            for (int i = 0; i < n; ++i) { ea += (double) a[(size_t) i] * a[(size_t) i]; eb += (double) b[(size_t) i] * b[(size_t) i]; }
            for (int k = -reach; k <= reach; ++k)
            {
                double c = 0.0;
                for (int i = juce::jmax (0, -k), end = juce::jmin (n, n - k); i < end; ++i) c += (double) a[(size_t) i] * b[(size_t) (i + k)];
                if (c > best) { best = c; lag = k; }
            }
            o->setProperty ("frames", n); o->setProperty ("lag", lag); o->setProperty ("alike", ea > 0.0 && eb > 0.0 ? best / std::sqrt (ea * eb) : 0.0);
            o->setProperty ("levelA", n > 0 ? std::sqrt (ea / n) : 0.0); o->setProperty ("levelB", n > 0 ? std::sqrt (eb / n) : 0.0);
            done (juce::var (o)); return;
        }
        if (op == "menus")     { done (okVar (slurSetMenus (juce::JSON::toString (d, true).toRawUTF8()))); return; }      // the menu bar as the page writes it (ui/menus.js)
        if (op == "menuState") { slurSetMenuState (juce::JSON::toString (d, true).toRawUTF8()); done (okVar()); return; }          // which of its lines are ticked
        if (op == "typing")    { slurSetTyping ((int) d["on"] != 0); done (okVar()); return; }                                     // a box in the page is being typed in
        if (op == "testRealKey")                                               // the check: a key put on the app's queue, as the keyboard does
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isNotEmpty() && getPeer() != nullptr) o->setProperty ("sent", juce::String (juce::CharPointer_UTF8 (slurTestRealKey (getPeer()->getNativeHandle(), d["key"].toString().toRawUTF8(), (unsigned short) (int) d["code"], (unsigned long) (juce::int64) d["mods"]).c_str())));
            done (juce::var (o)); return;
        }
        if (op == "testMenuKey")                                               // the check: a key given to the menu bar (the page's web view having the keys): taken or left
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isNotEmpty() && getPeer() != nullptr) o->setProperty ("took", juce::String (juce::CharPointer_UTF8 (slurTestMenuKey (getPeer()->getNativeHandle(), d["key"].toString().toRawUTF8(), (unsigned short) (int) d["code"], (unsigned long) (juce::int64) d["mods"]).c_str())));
            done (juce::var (o)); return;
        }
        if (op == "testCmdKey")                                                // the check: a key with command held, sent as the Mac sends one (the window's views first, then the menu bar)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isNotEmpty() && getPeer() != nullptr) o->setProperty ("took", juce::String (juce::CharPointer_UTF8 (slurCommandKey (getPeer()->getNativeHandle(), d["key"].toString().toRawUTF8(), (unsigned short) (int) d["code"]).c_str())));
            done (juce::var (o)); return;
        }
        if (op == "testCmdKeyOn")                                              // the check, a moment later: what the page did with that key (and, left alone, where it went then)
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isNotEmpty()) o->setProperty ("took", juce::String (juce::CharPointer_UTF8 (slurCommandKeyOn().c_str())));
            done (juce::var (o)); return;
        }
        if (op == "testFill")                                                  // the check: the whole window, its own bar with it, against what the screen leaves a window
        {
            auto* o = new juce::DynamicObject();
            if (auto* top = getTopLevelComponent())
                if (auto* p = top->getPeer())
                {
                    o->setProperty ("window", p->getFrameSize().addedTo (top->getBounds()).toString());
                    o->setProperty ("screen", juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()->userArea.toString());
                }
            done (juce::var (o)); return;
        }
        if (op == "testPanel") { auto* o = new juce::DynamicObject(); o->setProperty ("up", juce::String (juce::CharPointer_UTF8 (slurPanelUp ((int) d["cancel"] != 0).c_str()))); done (juce::var (o)); return; }      // the check: the Mac's save or open panel that is up, and its Cancel
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
            auto dir = audioDirOf (projectDir (d["project"].toString()));
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
                auto dir = audioDirOf (projectDir (d["project"].toString()));
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
            for (auto& f : audioDirOf (projectDir (d["project"].toString())).findChildFiles (juce::File::findFiles, false))
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
        if (op == "audioLoad")
        {
            /* a project's sound, by its name: in the project's own sounds; else wherever else a copy of the project may have
               left it (inside the project as projects kept them before, beside it, among the projects here under the same
               name); else in the folders the page was shown (`also`: picked by hand — then it is copied into the
               project's own sounds, so the project is whole again). Not found: {ok: false, missing: 1} */
            const auto dir = projectDir (d["project"].toString()), own = audioDirOf (dir);
            const auto name = d["file"].toString();
            juce::Array<juce::File> look { own, dir.getChildFile ("audio"), dir.getParentDirectory().getChildFile (AUDIO_FILES),
                                           projectsRoot().getChildFile (dir.getFileNameWithoutExtension()).getChildFile (AUDIO_FILES), projectsRoot().getChildFile (dir.getFileName()).getChildFile ("audio") };
            if (auto* also = d["also"].getArray()) for (auto& v : *also) look.add (juce::File (v.toString()));
            juce::File file;
            for (auto& at : look) if (at != juce::File() && at.getChildFile (name).existsAsFile()) { file = at.getChildFile (name); break; }
            if (file == juce::File()) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("missing", 1); o->setProperty ("file", name); done (juce::var (o)); return; }
            const bool adopt = (int) d["adopt"] != 0 && file.getParentDirectory() != own;
            auto alive = decodeAlive;
            decodePool.addJob ([this, alive, file, own, name, adopt, done] () mutable              // (on a thread of the pool: the answer comes back on the message thread)
            {
                if (adopt)
                {
                    own.createDirectory();
                    const auto in = own.getChildFile (name);
                    if ((in.existsAsFile() || file.copyFileTo (in)) && in.existsAsFile()) file = in;
                }
                auto v = withFile (engine.decodeFile (file), file.getFileName(), file.getFileNameWithoutExtension());
                juce::MessageManager::callAsync ([alive, done, v] () mutable { if (alive->load()) done (v); });
            });
            return;
        }
        if (op == "audioFind")                                                  // the folder the sounds of a project are in, picked by hand (the Mac lets the app read what is picked)
        {
            const auto dir = projectDir (d["project"].toString());
            chooser = std::make_unique<juce::FileChooser> ("Where are the sounds of " + dir.getFileNameWithoutExtension() + "?", dir.getParentDirectory(), "");
            chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectDirectories, [done] (const juce::FileChooser& fc)
            {
                auto* o = new juce::DynamicObject();
                const auto picked = fc.getResult();
                o->setProperty ("ok", picked.isDirectory()); o->setProperty ("dir", picked.getFullPathName());
                done (juce::var (o));
            });
            return;
        }
        if (op == "patchPreset")                                               // a track's patch as a file Patch on Slur opens (for the hand-off folder)
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("json", daw::Engine::patchPreset ((float) (double) d["tape"], (float) (double) d["space"], (float) (double) d["delay"], (float) (double) d["share"]));
            done (juce::var (o)); return;
        }
        if (op == "fileWrite")                                                 // a small file of the page's own making (the notes as a standard file, a page about the song), laid in a folder the app printed into: only inside the app's own place in Music
        {
            const juce::File dir (d["dir"].toString());
            const auto name = juce::File::createLegalFileName (d["name"].toString());
            juce::MemoryOutputStream mo;
            const bool inside = dir.isDirectory() && (dir == daw::musicRoot() || dir.isAChildOf (daw::musicRoot()));
            if (! inside || name.isEmpty() || d["data"].toString().length() > (1 << 26) || ! juce::Base64::convertFromBase64 (mo, d["data"].toString())) { done (okVar (false)); return; }
            done (okVar (dir.getChildFile (name).replaceWithData (mo.getData(), mo.getDataSize()))); return;
        }
        if (op == "importPick")                                                // the Mac's panel for sounds to bring in: where they lie (the page brings them in with audioBring)
        {
            chooser = std::make_unique<juce::FileChooser> ("Import Audio", juce::File::getSpecialLocation (juce::File::userMusicDirectory), "*.wav;*.aif;*.aiff;*.mp3;*.m4a;*.flac;*.ogg;*.caf");
            chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::canSelectMultipleItems, [done] (const juce::FileChooser& fc)
            {
                juce::Array<juce::var> out;
                for (auto& f : fc.getResults()) out.add (f.getFullPathName());
                done (out);
            });
            return;
        }
        if (op == "dropPaths")                                                 // where the files last let go on the page lie (Mac.mm, slurDroppedPaths): [{path, name, size}]
        {
            juce::Array<juce::var> out;
            for (auto& p : juce::StringArray::fromLines (juce::String::fromUTF8 (slurDroppedPaths().c_str())))
            {
                const juce::File f (p);
                if (p.isEmpty() || ! f.existsAsFile()) continue;
                auto* o = new juce::DynamicObject();
                o->setProperty ("path", p); o->setProperty ("name", f.getFileName()); o->setProperty ("size", (double) f.getSize());
                out.add (juce::var (o));
            }
            done (out); return;
        }
        if (op == "audioBring")
        {
            /* sounds brought in by where they lie (let go from the Finder, or picked with Import Audio…): each copied into
               the project's own sounds — a clone where the disk can make one, which takes no time and no room whatever
               its length — on a thread of the pool, and said with its length, read from its head. Nothing is decoded
               here: the page places them at once and asks for each with audioLoad, several at a time.
               -> [{ok, file, name, sec}] in the order given */
            const auto own = audioDirOf (projectDir (d["project"].toString()));
            juce::StringArray paths;
            if (auto* a = d["paths"].getArray()) for (auto& v : *a) paths.add (v.toString());
            auto alive = decodeAlive;
            decodePool.addJob ([this, alive, own, paths, done] () mutable
            {
                own.createDirectory();
                juce::Array<juce::var> out;
                for (auto& p : paths)
                {
                    auto* o = new juce::DynamicObject();
                    juce::var v (o);
                    const auto src = juce::File (p).getLinkedTarget();
                    o->setProperty ("ok", false); o->setProperty ("name", src.getFileNameWithoutExtension());
                    if (src.existsAsFile())
                    {
                        const bool ours = src.getParentDirectory() == own;      // (one of its own sounds already: taken as it lies)
                        juce::File dst = src;
                        bool made = ours;
                        for (int tries = 0; ! made && tries < 4; ++tries)       // (another bringing in may have taken the name meanwhile)
                        {
                            dst = own.getNonexistentChildFile (juce::File::createLegalFileName (src.getFileNameWithoutExtension()), src.getFileExtension(), false);
                            made = ::copyfile (src.getFullPathName().toRawUTF8(), dst.getFullPathName().toRawUTF8(), nullptr, COPYFILE_CLONE) == 0;
                            if (! made && errno != EEXIST) { dst.deleteFile(); break; }  // (a copy that could not be finished — the disk full, say — leaves nothing half made)
                        }
                        const double sec = made ? engine.fileSeconds (dst) : 0.0;
                        if (sec > 0.0) { o->setProperty ("ok", true); o->setProperty ("file", dst.getFileName()); o->setProperty ("sec", sec); }
                        else if (made && ! ours) dst.deleteFile();             // (not a sound after all)
                    }
                    out.add (v);
                }
                juce::MessageManager::callAsync ([alive, done, out] () mutable { if (alive->load()) done (out); });
            });
            return;
        }
        if (op == "quit") { done (okVar()); juce::MessageManager::callAsync ([] { juce::JUCEApplication::quit(); }); return; }
        if (op == "quitWait") { quitIn = 0; done (okVar()); return; }          // the page is asking whether to save first: the app does not close by itself meanwhile (it closes when the page says quit)
        if (op == "paramScale") { done (engine.pluginScale ((int) d["track"], (int) d["uid"], (int) d["index"])); return; }      // how one control reads along its travel
        if (op == "sideFrom")  { done (engine.setSide ((int) d["track"], (int) d["from"])); return; }       // what a side on a track's wall plays (ui/side.js)
        if (op == "paramSet")  { done (okVar (engine.setPluginParam ((int) d["track"], (int) d["uid"], (int) d["index"], (float) (double) d["v"]))); return; }      // one control set by hand (a macro turned)
        if (op == "params")    { done (engine.pluginParams ((int) d["track"], (int) d["uid"])); return; }       // a plug-in's controls, for a line to be drawn for one
        if (op == "touched")   { done (engine.pluginTouched ((int) d["track"], (int) d["uid"])); return; }      // the control last moved in its window
        if (op == "testHosts")                                                 // the check: audio units opened through the library and by the app itself, laid side by side
        {
            juce::StringArray ids;
            if (auto* list = d["ids"].getArray()) for (auto& v : *list) ids.add (v.toString());
            if (selfTestMode().isNotEmpty()) engine.compareHosts (ids, [done] (juce::var r) { done (r); }); else done (okVar (false));
            return;
        }
        if (op == "testTouch") { if (selfTestMode().isNotEmpty()) engine.testTouch ((int) d["track"], (int) d["uid"], (int) d["i"], (float) (double) d["v"]); done (okVar()); return; }
        if (op == "keyFrom") { done (engine.setKey ((int) d["track"], (int) d["uid"], (int) d["from"])); return; }      // a plug-in is given a track to listen to (its key, or side chain); 0: none
        if (op == "bypass")  { engine.bypassPlugin ((int) d["track"], (int) d["uid"], (int) d["off"] != 0); done (okVar()); return; }
        /* the meter (Meter.h): what one shows now, its count begun again, and its face — a window for each meter, by the
           track and the node it stands at; shown again where it was left */
        if (op == "meterRead")  { done (engine.meterRead ((int) d["track"], (int) d["id"], d.hasProperty ("sec") ? (double) d["sec"] : 10.0)); return; }
        if (op == "meterReset") { engine.meterReset ((int) d["track"], d.hasProperty ("id") ? (int) d["id"] : -1); done (okVar()); return; }
        if (op == "meterShow")
        {
            const auto key = d["track"].toString() + "." + d["id"].toString();
            auto& w = meters[key];
            if (w == nullptr)
                w = std::make_unique<MeterWindow> ([] (const juce::String& path) { return serve (path); },
                                                   [this] (const juce::String& o2, const juce::var& d2, MeterWindow::Done dn) { handle (o2, d2, std::move (dn)); },
                                                   "track=" + d["track"].toString() + "&id=" + d["id"].toString() + "&name=" + juce::URL::addEscapeChars (d["name"].toString(), true) + "&c=" + juce::URL::addEscapeChars (d["c"].toString(), true), lang, selfTestMode().isEmpty());
            else { w->setVisible (true); w->toFront (true); }
            if (d["name"].toString().isNotEmpty()) w->setName ("meter, " + d["name"].toString());
            done (okVar()); return;
        }
        if (op == "meterClose")                                                // the meter was taken off the wall (or its track is gone): its face goes
        {
            const auto key = d["track"].toString() + "." + d["id"].toString();
            if (d["all"].toString() == "1") meters.clear(); else meters.erase (key);
            done (okVar()); return;
        }
        if (op == "testMeterAsk")                                              // the check: a question put to a meter's face (a line of JavaScript that answers with JSON)
        {
            const auto it = meters.find (d["track"].toString() + "." + d["id"].toString());
            if (selfTestMode().isEmpty() || it == meters.end() || it->second == nullptr) { done (okVar (false)); return; }
            it->second->page().evaluateJavascript (d["js"].toString(), [done] (juce::WebBrowserComponent::EvaluationResult r) { done (r.getResult() != nullptr ? juce::JSON::parse (r.getResult()->toString()) : juce::var()); });
            return;
        }
        if (op == "testMeterSnap")                                             // the check: a picture of a meter's face as its window shows it
        {
            const auto it = meters.find (d["track"].toString() + "." + d["id"].toString());
            if (selfTestMode().isEmpty() || it == meters.end() || it->second == nullptr || it->second->getPeer() == nullptr) { done (okVar (false)); return; }
            slurSnapshotWebView (it->second->getPeer()->getNativeHandle(), logDir().getChildFile (juce::File::createLegalFileName (d["name"].toString())).getFullPathName().toRawUTF8(), false);
            done (okVar()); return;
        }
        if (op == "meterOpen")  { juce::Array<juce::var> a; for (auto& kv : meters) if (kv.second != nullptr && kv.second->isVisible()) a.add (kv.first); done (juce::var (a)); return; }      // which faces are up (for the check)
        if (op == "editor")  { engine.openEditor ((int) d["track"], (int) d["uid"]); done (okVar()); return; }
        if (op == "remove")  { done (okVar (engine.removePlugin ((int) d["track"], (int) d["uid"]))); return; }
        if (op == "decode")
        {
            juce::MemoryBlock mb;
            { juce::MemoryOutputStream os (mb, false); juce::Base64::convertFromBase64 (os, d["data"].toString()); }
            done (engine.decode (mb)); return;
        }
        if (op == "bouncePick")                                                // where a bounce goes and what it is called: the Mac's own panel, on the folder the last one went to
        {
            const auto typed = d["name"].toString().trim().isEmpty() ? juce::String() : daw::printName (d["name"].toString());
            const auto name = typed.isEmpty() ? juce::String ("bounce") : typed;
            const bool test = selfTestMode().isNotEmpty();
            /* ext: what is printed is ONE file of that kind (the mix): the panel asks for the file itself — "song mix.wav" — and
               the answer is the folder it goes into and its name; without it, a folder is made for the files (stems) */
            const auto ext = d["ext"].toString().trim().toLowerCase().retainCharacters ("abcdefghijklmnopqrstuvwxyz0123456789");
            const auto answer = [done, ext] (const juce::File& f)
            {
                if (f == juce::File()) { done (okVar (false)); return; }
                auto* o = new juce::DynamicObject();
                if (ext.isNotEmpty())
                {
                    if (f.isDirectory()) { done (whyNot ("file")); return; }
                    o->setProperty ("ok", true); o->setProperty ("dir", f.getParentDirectory().getFullPathName()); o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("single", true);
                    done (juce::var (o)); return;
                }
                if (f.existsAsFile()) { done (whyNot ("file")); return; }                   // (what is made is a folder: a file of that name is not written over)
                o->setProperty ("ok", true); o->setProperty ("dir", f.getFullPathName()); o->setProperty ("name", f.getFileName());
                done (juce::var (o));
            };
            const auto own = d["project"].isString() ? bouncesDirOf (projectDir (d["project"].toString())) : juce::File();      // (a project in a folder of its own: its Bounces, always)
            if (own != juce::File()) own.createDirectory();
            if (test && (int) d["panel"] == 0) { answer ((own != juce::File() ? own : daw::musicRoot()).getNonexistentChildFile (name, ext.isNotEmpty() ? "." + ext : juce::String(), false)); return; }      // the check has no hands for a panel
            auto in = daw::musicRoot();
            if (own != juce::File()) in = own;
            else if (! test)
            {
                const auto last = juce::JSON::parse (prefsFile())["bounceDir"].toString();
                if (last.isNotEmpty() && juce::File::isAbsolutePath (last) && juce::File (last).isDirectory()) in = juce::File (last);
            }
            in.createDirectory();
            chooser = std::make_unique<juce::FileChooser> ("Bounce", in.getNonexistentChildFile (name, ext.isNotEmpty() ? "." + ext : juce::String(), false), ext.isNotEmpty() ? "*." + ext : juce::String());
            chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::warnAboutOverwriting, [answer, test] (const juce::FileChooser& fc)
            {
                const auto f = fc.getResult();
                if (f != juce::File() && ! test)                                            // the next one is asked for in the same place
                {
                    auto v = juce::JSON::parse (prefsFile());
                    if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                    v.getDynamicObject()->setProperty ("bounceDir", f.getParentDirectory().getFullPathName());
                    prefsFile().getParentDirectory().createDirectory();
                    prefsFile().replaceWithText (juce::JSON::toString (v));
                }
                answer (f);
            });
            return;
        }
        if (op == "bounce")
        {
            juce::Component::SafePointer<MainComponent> self (this);
            juce::var opts = d;
            if (d["kind"].toString() == "place")                      // a bounce in place lands in the project's own folder
                if (auto* o = d.getDynamicObject()) { auto c = o->clone(); c->setProperty ("dir", audioDirOf (projectDir (d["project"].toString())).getFullPathName()); opts = juce::var (c.release()); }
            engine.exportAudio (opts, [self] (int n, int total)
            {
                if (self == nullptr) return;
                auto* o = new juce::DynamicObject();
                if (n >= 0) { o->setProperty ("done", n); o->setProperty ("total", total); }       // (a file more is done; without these: only how far along the file under way is)
                o->setProperty ("part", n >= 0 ? 1.0 : (double) total / 1000.0);                  // (told with -1: `total` carries how far along, in thousandths, as it was when this was sent)
                self->web->emitEventIfBrowserIsVisible ("dawBounce", juce::var (o));
            }, [done] (juce::var r) { done (r); });
            return;
        }
        if (op == "probe")  { engine.probe (d, [done] (juce::var r) { done (r); }); return; }      // a plug-in learnt by what it does (ui/probe.js)
        if (op == "listen") { engine.listen (d, [done] (juce::var r) { done (r); }); return; }      // how tracks sound over a stretch, as numbers (Engine::listen)
        if (op == "bounceLive")                                                // a print played through in real time (Engine::liveStart): the room draws it as it goes
        {
            juce::var opts = d;
            if (d["kind"].toString() == "place")
                if (auto* o = d.getDynamicObject()) { auto c = o->clone(); c->setProperty ("dir", audioDirOf (projectDir (d["project"].toString())).getFullPathName()); opts = juce::var (c.release()); }
            engine.liveStart (opts, [done] (juce::var r) { done (r); });
            return;
        }
        if (op == "bounceLiveStop") { engine.liveStop(); done (okVar()); return; }
        if (op == "bounceStop")     { engine.printStop(); done (okVar()); return; }      // esc while a print is under way, offline or not: it stops, and nothing of it is kept      // (its answer is the one bounceLive gives)
        if (op == "bounceLiveNow")  { done (engine.liveNow()); return; }
        if (op == "join")                                                      // regions made one sound: a file of its own in the project's folder for each stretch (see Engine::joinRegions)
        {
            juce::var opts = d;
            if (auto* o = d.getDynamicObject()) { auto c = o->clone(); c->setProperty ("dir", audioDirOf (projectDir (d["project"].toString())).getFullPathName()); opts = juce::var (c.release()); }
            engine.joinRegions (opts, [done] (juce::var r) { done (r); });
            return;
        }
        if (op == "log") { daw::logLine ("page: " + d["text"].toString()); done (okVar()); return; }
        if (op == "stalls") { auto* o = new juce::DynamicObject(); o->setProperty ("ms", juce::roundToInt (stallMax)); stallMax = 0.0; done (juce::var (o)); return; }      // the longest the window stood still since last asked
        if (op == "testPerf")  { done (engine.takePerf()); return; }
        if (op == "testRest")  { engine.restOn.store ((int) d["on"] != 0); done (okVar()); return; }      // the check: tracks may rest, or not (Engine::playTrack)
        if (op == "testSound") { done (engine.testSound (audioDirOf (projectDir (d["project"].toString())).getChildFile (d["file"].toString()))); return; }
        if (op == "testHands") { engine.setHands ((int) d["n"]); auto* o = new juce::DynamicObject(); o->setProperty ("threads", engine.hands() + 1); done (juce::var (o)); return; }       // how many threads share a block (-1: as the machine allows)
        if (op == "testMulti")                                                 // (the check only) the sounds selftest.sh laid in the check's own folder from SLUR_MULTI: {name of their folder, paths}, for the step multi
        {
            auto* o = new juce::DynamicObject();
            juce::Array<juce::var> paths;
            if (selfTestMode().isNotEmpty())
                for (auto& sub : daw::musicRoot().getChildFile ("multi").findChildFiles (juce::File::findDirectories, false, "*"))
                {
                    auto files = sub.findChildFiles (juce::File::findFiles, false, "*.wav;*.aif;*.aiff");
                    files.sort();
                    for (auto& f : files) paths.add (f.getFullPathName());
                    o->setProperty ("name", sub.getFileName());
                    break;
                }
            o->setProperty ("paths", paths);
            done (juce::var (o)); return;
        }
        if (op == "testFile")                                                  // a sound of a given length, made here and laid in the project's folder (the same every time: bursts of noise over a low tone)
        {
            const double sec = juce::jlimit (0.5, 3600.0, (double) d["sec"]), rate = d.hasProperty ("rate") ? (double) d["rate"] : engine.sr;
            const int ch = juce::jlimit (1, 2, d.hasProperty ("ch") ? (int) d["ch"] : 2);
            auto dir = audioDirOf (projectDir (d["project"].toString()));
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
            o->setProperty ("ok", ok); o->setProperty ("file", file.getFileName()); o->setProperty ("mb", (double) file.getSize() / 1048576.0); o->setProperty ("path", file.getFullPathName());
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
            const auto file = audioDirOf (projectDir (d["project"].toString())).getChildFile (d["file"].toString());
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
        const auto setup = engine.devices().getAudioDeviceSetup();            // what it listens to and plays through, by name (the start page says them)
        o.setProperty ("inName", setup.inputDeviceName); o.setProperty ("outName", setup.outputDeviceName);
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
        slur->goToURL (base + "/?surface=panel&plugin=1" + (slurLight ? "&look=light" : "") + "&v=" + juce::String (juce::Time::currentTimeMillis()));      // (light: the room's ground has grown light — slurLook)
        daw::logLine ("slur: the studio's panel is opening from " + base);
    }

    void timerCallback() override
    {
        if (quitIn > 0 && --quitIn == 0) { juce::JUCEApplication::quit(); return; }
        {
            /* the window standing still: the longest wait between two of these (thirty a second when all is well) is kept
               for the check (op stalls), and one of more than a second and a half — the Mac's spinning wheel — is written
               into the log, so that a slow opening on another Mac can be told from a frozen one */
            const double now = juce::Time::getMillisecondCounterHiRes();
            if (lastTick > 0.0) { const double gap = now - lastTick; stallMax = juce::jmax (stallMax, gap); if (gap > 1500.0) daw::logLine ("stall: the window stood still for " + juce::String (gap / 1000.0, 1) + " s"); }
            lastTick = now;
        }
        if (++ticks % 6 == 0) engine.warm();                                   // five times a second: the sound just ahead of the playhead is asked for
        engine.liveTick();                                                     // a realtime print whose range has gone by is made into its files
        auto* o = new juce::DynamicObject();
        o->setProperty ("p", engine.posBars.load());
        o->setProperty ("on", engine.playing.load());
        o->setProperty ("j", engine.jumps.load());
        o->setProperty ("r", engine.recording.load());
        o->setProperty ("m", engine.takeMeters());
        o->setProperty ("c", engine.devices().getCpuUsage());
        web->emitEventIfBrowserIsVisible ("dawTick", juce::var (o));
    }

    /** What the settings window shows of the device and the engine, as they are now. */
    juce::var settingsNow()
    {
        auto* o = new juce::DynamicObject();
        auto& dm = engine.devices();
        const auto setup = dm.getAudioDeviceSetup();
        juce::Array<juce::var> outs, ins, rates, blocks;
        auto in = setup.inputDeviceName;
        if (auto* type = dm.getCurrentDeviceTypeObject())
        {
            for (auto& n : type->getDeviceNames (false)) outs.add (n);
            const auto names = type->getDeviceNames (true);
            for (auto& n : names) ins.add (n);
            if (in.isEmpty()) { const int def = type->getDefaultDeviceIndex (true); if (def >= 0 && def < names.size()) in = names[def]; }      // none chosen: the one the Mac would give
        }
        o->setProperty ("lang", lang);
        o->setProperty ("llm", engine.lowLatMs.load());
        if (settings != nullptr) { const auto part = settings->takeAsked(); if (part.isNotEmpty()) o->setProperty ("part", part); }
        o->setProperty ("outs", outs); o->setProperty ("ins", ins); o->setProperty ("out", setup.outputDeviceName); o->setProperty ("in", in);
        if (auto* dev = dm.getCurrentAudioDevice())
        {
            for (auto r : dev->getAvailableSampleRates()) rates.add (r);
            for (auto b : dev->getAvailableBufferSizes()) blocks.add (b);
            o->setProperty ("rate", dev->getCurrentSampleRate()); o->setProperty ("block", dev->getCurrentBufferSizeSamples());
            o->setProperty ("outLat", dev->getOutputLatencyInSamples()); o->setProperty ("inLat", dev->getInputLatencyInSamples());
        }
        else { o->setProperty ("rate", engine.sr); o->setProperty ("block", engine.block); o->setProperty ("outLat", 0); o->setProperty ("inLat", 0); }
        o->setProperty ("rates", rates); o->setProperty ("blocks", blocks);
        o->setProperty ("inputOn", engine.inputCount() > 0 && ! engine.testInput);      // (the check's input is a tone of its own, not the machine's)
        o->setProperty ("level", engine.inputNow());
        o->setProperty ("threads", engine.hands() + 1); o->setProperty ("asked", engine.handsAsked());
        o->setProperty ("cores", juce::SystemStats::getNumPhysicalCpus());
        o->setProperty ("busy", engine.busy());
        return juce::var (o);
    }
    /** One thing set from the settings window: {what: out | in | rate | block | threads, value}. Taken at once; the device
        says so itself when it has changed (changeListenerCallback keeps it for the next start). -> {ok, why? | error?} */
    juce::var settingsSet (const juce::var& d)
    {
        const auto what = d["what"].toString();
        if (what == "lang")                                                    // the language the program speaks: every page is told, and writes itself again
        {
            lang = d["value"].toString() == "ko" ? "ko" : "en";
            if (selfTestMode().isEmpty())
            {
                auto v = juce::JSON::parse (prefsFile());
                if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                v.getDynamicObject()->setProperty ("lang", lang);
                prefsFile().getParentDirectory().createDirectory();
                prefsFile().replaceWithText (juce::JSON::toString (v));
            }
            for (auto* page : { web.get(), settings != nullptr ? &settings->page() : nullptr })
                if (page != nullptr) { auto* o = new juce::DynamicObject(); o->setProperty ("lang", lang); page->emitEventIfBrowserIsVisible ("dawLang", juce::var (o)); }
            return okVar();
        }
        if (what == "llm")                                                     // settings > audio: low latency mode's limit — kept, and the room told (what is stepped past may change)
        {
            const int ms = juce::jlimit (1, 100, (int) d["value"]);
            if (selfTestMode().isEmpty())
            {
                auto v = juce::JSON::parse (prefsFile());
                if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                v.getDynamicObject()->setProperty ("llm", ms);
                prefsFile().getParentDirectory().createDirectory();
                prefsFile().replaceWithText (juce::JSON::toString (v));
            }
            const auto facts = engine.setLowLatency (engine.lowLat.load(), ms);
            if (web != nullptr) web->emitEventIfBrowserIsVisible ("dawLowLat", facts);
            return okVar();
        }
        if (what == "plugOut" || what == "plugKind" || what == "keys")         // settings > plug-ins: the ones left out of the room's lists, the kinds set by hand (ui/cats.js); settings > key commands: the set of keys (ui/keymap.js) — kept, and the room told at once
        {
            if (selfTestMode().isEmpty())
            {
                auto v = juce::JSON::parse (prefsFile());
                if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                v.getDynamicObject()->setProperty (juce::Identifier (what), d["value"]);
                prefsFile().getParentDirectory().createDirectory();
                prefsFile().replaceWithText (juce::JSON::toString (v));
            }
            if (web != nullptr && what == "keys") { auto* o = new juce::DynamicObject(); o->setProperty ("keys", d["value"]); web->emitEventIfBrowserIsVisible ("dawKeys", juce::var (o)); }
            else if (web != nullptr && what == "plugKind") { auto* o = new juce::DynamicObject(); o->setProperty ("kinds", d["value"]); web->emitEventIfBrowserIsVisible ("dawPlugKind", juce::var (o)); }
            else if (web != nullptr) { auto* o = new juce::DynamicObject(); o->setProperty ("ids", d["value"]); o->setProperty ("again", (bool) d["again"]); web->emitEventIfBrowserIsVisible ("dawPlugOut", juce::var (o)); }
            return okVar();
        }
        if (what == "look")                                                    // settings > display: the look the room wears (ui/look.js) — kept, and the room told at once
        {
            if (selfTestMode().isEmpty())
            {
                auto v = juce::JSON::parse (prefsFile());
                if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                v.getDynamicObject()->setProperty ("look", d["value"]);
                prefsFile().getParentDirectory().createDirectory();
                prefsFile().replaceWithText (juce::JSON::toString (v));
            }
            if (web != nullptr) { auto* o = new juce::DynamicObject(); o->setProperty ("look", d["value"]); web->emitEventIfBrowserIsVisible ("dawLook", juce::var (o)); }
            return okVar();
        }
        if (engine.busy()) return whyNot ("busy");
        if (what == "threads")                                                 // threads in all; 0: as many as the machine allows
        {
            const int n = (int) d["value"];
            engine.setHands (n > 0 ? n - 1 : -1);
            if (selfTestMode().isEmpty())
            {
                auto v = juce::JSON::parse (prefsFile());
                if (! v.isObject()) v = juce::var (new juce::DynamicObject());
                v.getDynamicObject()->setProperty ("hands", n > 0 ? n - 1 : -1);
                prefsFile().getParentDirectory().createDirectory();
                prefsFile().replaceWithText (juce::JSON::toString (v));
            }
            return okVar();
        }
        auto& dm = engine.devices();
        auto setup = dm.getAudioDeviceSetup();
        if (what == "out") setup.outputDeviceName = d["value"].toString();
        else if (what == "in")
        {
            setup.inputDeviceName = d["value"].toString();
            if (engine.inputCount() == 0) { setup.useDefaultInputChannels = false; setup.inputChannels.clear(); }      // chosen, not opened: the input opens when a track asks for it (enableInput)
        }
        else if (what == "rate") setup.sampleRate = (double) d["value"];
        else if (what == "block") setup.bufferSize = (int) d["value"];
        else return whyNot ("what");
        if (selfTestMode().isNotEmpty()) return whyNot ("check");              // the check never moves the machine's device: every program that plays shares it
        const auto err = dm.setAudioDeviceSetup (setup, true);
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", err.isEmpty());
        if (err.isNotEmpty()) { o->setProperty ("error", err); daw::logLine ("settings: " + what + " would not be set: " + err); }
        return juce::var (o);
    }

    std::unique_ptr<juce::WebBrowserComponent> web, slur;
    bool slurLight = false;                                                    // slur's panel is light: the room's look asked for it (slurLook)
    juce::var keysCatalog;                                                     // the room's commands, for settings > key commands (keysCatalog)
    bool keysToPage = false, dropsKnown = false;                                                   // (command x, c, v and a go to the page as keys: see slurKeysToPage)
    std::unique_ptr<SettingsWindow> settings;
    std::map<juce::String, std::unique_ptr<MeterWindow>> meters;      // the meters' faces, by track and node
    juce::String lang { "en" };
    juce::String pendingOpen;
    bool pageUp = false;
    std::unique_ptr<juce::FileChooser> chooser;
    std::map<juce::String, juce::File> uploads;
    int quitIn = 0, lastTracks = -1, ticks = 0;
    double lastTick = 0.0, stallMax = 0.0;
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
        /* it opens as large as the screen lets a window be — all of it under the menu bar and beside the Dock — the way
           Logic's does. (The app's own check keeps the size its pictures are measured at.) */
        const auto area = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()->userArea;
        const bool whole = selfTestMode().isEmpty() || selfTestMode() == "start";      // (and the one part of the check that opens it as a hand does)
        setSize (juce::jmin (getWidth(), area.getWidth()), juce::jmin (getHeight(), area.getHeight()));
        centreWithSize (getWidth(), getHeight());
        setVisible (true);
        if (auto* p = getPeer())
        {
            if (whole) setBounds (p->getFrameSize().subtractedFrom (area));       // (the window's own bar is part of what has to fit)
            slurStyleWindow (p->getNativeHandle());
        }
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
    const juce::String getApplicationVersion() override { return "0.1.7"; }
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
        if (selfTestMode().isEmpty() && ! makerApp()) moveToNewName();         // (before anything is read: the mark of the last run lies in one of the folders)
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
        daw::logLine ("handed: " + commandLine + (name.isEmpty() ? "  (not a project)" : juce::String()));
        if (window != nullptr && window->main() != nullptr && test == nullptr) window->main()->openProject (name);
    }
private:
    std::unique_ptr<MainWindow> window;
    std::unique_ptr<SelfTest> test;
};

START_JUCE_APPLICATION (SlurDawApp)
