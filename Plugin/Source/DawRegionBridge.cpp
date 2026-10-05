#include "DawRegionBridge.h"
#if JUCE_MAC || JUCE_LINUX
#include <sys/stat.h>
#endif

namespace
{
juce::String errorResult (const juce::String& message)
{
    auto* object = new juce::DynamicObject();
    object->setProperty ("ok", false);
    object->setProperty ("error", message);
    return juce::JSON::toString (juce::var (object));
}

class RegionJob final : public juce::ThreadPoolJob
{
public:
    RegionJob (juce::var request, juce::String audio,
               juce::WebBrowserComponent::NativeFunctionCompletion callback,
               std::weak_ptr<std::atomic_bool> owner)
        : ThreadPoolJob ("Orb region transfer"), input (std::move (request)),
          base64 (std::move (audio)), done (std::move (callback)), alive (std::move (owner)) {}

    JobStatus runJob() override
    {
        juce::String result;
        const auto runtime = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                .getChildFile ("Application Support/Orb/DawBridge");
        const auto folder = runtime.getChildFile ("Jobs").getChildFile (juce::Uuid().toString());
        const auto node = runtime.getChildFile ("node");
        const auto script = runtime.getChildFile ("src/native.cjs");
        if (! node.existsAsFile() || ! script.existsAsFile() || ! runtime.getChildFile ("settings.json").existsAsFile())
            result = errorResult ("The Orb region bridge is not installed.");
        else if (! folder.createDirectory() || ! folder.getChildFile ("request.json").replaceWithText (juce::JSON::toString (input)))
            result = errorResult ("Could not create the region transfer job.");
        else
        {
#if JUCE_MAC || JUCE_LINUX
            ::chmod (folder.getFullPathName().toRawUTF8(), 0700);
#endif
            bool valid = true;
            if (input["operation"].toString() == "import" || input["operation"].toString() == "exportLogic"
                || input["operation"].toString() == "prepareLogic")
            {
                juce::MemoryOutputStream decoded;
                valid = base64.length() <= 420 * 1024 * 1024 && juce::Base64::convertFromBase64 (decoded, base64)
                    && decoded.getDataSize() <= 300ULL * 1024 * 1024
                    && folder.getChildFile ("input.orb-regions.zip").replaceWithData (decoded.getData(), decoded.getDataSize());
            }
            base64.clear();
            if (! valid) result = errorResult ("The region archive is invalid or exceeds the native transfer limit.");
            else
            {
                juce::ChildProcess child;
                if (! child.start (juce::StringArray { node.getFullPathName(), script.getFullPathName(), folder.getFullPathName() }))
                    result = errorResult ("Could not start the region bridge.");
                else
                {
                    const auto started = juce::Time::getMillisecondCounterHiRes();
                    const auto deadline = input["operation"].toString() == "inspectLogic" ? 10000
                        : input["operation"].toString() == "exportTracks" ? 1800000
                        : input["operation"].toString().containsIgnoreCase ("logic") ? 600000 : 240000;
                    while (child.isRunning() && ! shouldExit()
                           && juce::Time::getMillisecondCounterHiRes() - started < deadline)
                        juce::Thread::sleep (25);
                    if (child.isRunning())
                    {
                        child.kill();
                        result = errorResult ("Transfer interrupted. Inspect the transfer journal before retrying.");
                    }
                    else
                    {
                        const auto response = folder.getChildFile ("response.json");
                        auto value = juce::JSON::parse (response.loadFileAsString());
                        if (! value.isObject()) result = errorResult ("The bridge returned no result. Inspect the transfer journal.");
                        else
                        {
                            const auto operation = input["operation"].toString();
                            if ((operation == "capture" || operation == "captureLogic" || operation == "exportTracks") && (bool) value["ok"])
                            {
                                const auto archive = folder.getChildFile ("selection.orb-regions.zip");
                                juce::MemoryBlock bytes;
                                if (archive.getSize() > 300LL * 1024 * 1024 || ! archive.loadFileAsData (bytes))
                                    value = juce::JSON::parse (errorResult ("Captured regions exceed the native transfer limit."));
                                else value.getDynamicObject()->setProperty ("data", juce::Base64::toBase64 (bytes.getData(), bytes.getSize()));
                            }
                            if (operation == "exportLogic" && (bool) value["ok"])
                            {
                                const auto archive = folder.getChildFile ("Orb-regions.aaf");
                                if (! archive.existsAsFile() || archive.getSize() <= 0 || archive.getSize() > 300LL * 1024 * 1024)
                                    value = juce::JSON::parse (errorResult ("The Logic AAF is missing or exceeds the transfer limit."));
                                else value.getDynamicObject()->setProperty ("path", archive.getFullPathName());
                            }
                            result = juce::JSON::toString (value, true);
                        }
                    }
                }
            }
        }
        if (! shouldExit())
        {
            auto callback = std::move (done);
            juce::MessageManager::callAsync ([callback = std::move (callback), result, owner = alive] {
                if (const auto life = owner.lock(); life && life->load())
                    callback (juce::var (result));
            });
        }
        return jobHasFinished;
    }
private:
    juce::var input;
    juce::String base64;
    juce::WebBrowserComponent::NativeFunctionCompletion done;
    std::weak_ptr<std::atomic_bool> alive;
};
}

void DawRegionBridge::invoke (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion done,
                             juce::Component* dialogParent)
{
    if (! args.isArray() || args.size() < 1 || args.size() > 3)
    { done (juce::var (errorResult ("Invalid region request."))); return; }
    const auto operation = args[0].toString();
    // Reject old web clients before staging audio or starting the helper.
    if (operation == "prepareLogic" || operation == "dropLogic")
    { done (juce::var (errorResult ("Dialog-driven Logic restoration is disabled. Native timeline restoration is not supported."))); return; }
    if (operation != "inspect" && operation != "inspectTracks" && operation != "exportTracks"
        && operation != "capture" && operation != "import" && operation != "exportLogic"
        && operation != "captureLogic" && operation != "inspectLogic")
    { done (juce::var (errorResult ("Unknown region request."))); return; }
    if (pool.getNumJobs() != 0)
    { done (juce::var (errorResult ("A region transfer is already running."))); return; }
    if (operation == "exportLogic")
    {
        auto completion = std::move (done);
        done = [completion = std::move (completion), owner = std::weak_ptr (alive),
                parent = juce::Component::SafePointer<juce::Component> (dialogParent)] (juce::var result) {
            auto response = juce::JSON::parse (result.toString());
            if (! (bool) response["ok"]) { completion (result); return; }
            const juce::File source (response["path"].toString());
            auto chooser = std::make_shared<juce::FileChooser> ("Export AAF for Logic Pro",
                juce::File::getSpecialLocation (juce::File::userDocumentsDirectory).getChildFile ("Orb-regions.aaf"),
                "*.aaf", true, false, parent.getComponent());
            chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles
                                 | juce::FileBrowserComponent::warnAboutOverwriting,
                [chooser, source, response, completion, owner] (const juce::FileChooser& dialog) mutable {
                    const auto life = owner.lock();
                    if (! life || ! life->load()) return;
                    const auto destination = dialog.getResult();
                    response.getDynamicObject()->removeProperty ("path");
                    if (destination == juce::File()) response.getDynamicObject()->setProperty ("status", "cancelled");
                    else
                    {
                        juce::TemporaryFile temporary (destination);
                        if (! source.copyFileTo (temporary.getFile()) || ! temporary.overwriteTargetFileWithTemporary())
                        { completion (juce::var (errorResult ("Could not save the Logic AAF."))); return; }
                        response.getDynamicObject()->setProperty ("status", "saved");
                    }
                    completion (juce::var (juce::JSON::toString (response)));
                });
        };
    }
    auto* object = new juce::DynamicObject();
    object->setProperty ("operation", operation);
    if (args.size() > 1) object->setProperty ("sessionId", args[1].toString());
    if (operation == "exportTracks")
    {
        const auto options = args.size() > 2 ? juce::JSON::parse (args[2].toString()) : juce::var();
        if (! options.isObject())
        { delete object; done (juce::var (errorResult ("Invalid track export options."))); return; }
        object->setProperty ("options", options);
    }
    pool.addJob (new RegionJob (juce::var (object), args.size() > 2 ? args[2].toString() : juce::String(), std::move (done), alive), true);
}
