#include "TrackExportBridge.h"
#if JUCE_MAC
#include <sys/stat.h>
#endif
namespace {
juce::var failure (const juce::String& message)
{
    auto* result = new juce::DynamicObject();
    result->setProperty ("ok", false); result->setProperty ("error", message);
    return juce::var (result);
}
class ExportJob final : public juce::ThreadPoolJob
{
public:
    ExportJob (juce::var input, juce::WebBrowserComponent::NativeFunctionCompletion completion,
               std::weak_ptr<std::atomic_bool> lifetime)
        : ThreadPoolJob ("Slur track export"), request (std::move (input)), done (std::move (completion)), alive (std::move (lifetime)) {}
    JobStatus runJob() override
    {
        const auto runtime = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
            .getChildFile ("Application Support/Slur/TrackExport");
        const auto folder = runtime.getChildFile ("Jobs").getChildFile (juce::Uuid().toString());
        juce::var result = failure ("The Slur track export helper is not installed. Reinstall the matching Slur build.");
        if (runtime.getChildFile ("node").existsAsFile() && runtime.getChildFile ("native.cjs").existsAsFile()
            && folder.createDirectory())
        {
           #if JUCE_MAC
            ::chmod (folder.getFullPathName().toRawUTF8(), 0700);
           #endif
            if (folder.getChildFile ("request.json").replaceWithText (juce::JSON::toString (request)))
            {
                juce::ChildProcess child;
                if (child.start (juce::StringArray {runtime.getChildFile ("node").getFullPathName(),
                    runtime.getChildFile ("native.cjs").getFullPathName(), folder.getFullPathName()}))
                {
                    const auto started = juce::Time::getMillisecondCounterHiRes();
                    const auto deadline = request["operation"].toString().startsWith ("export") ? 1800000 : 240000;
                    while (child.isRunning() && ! shouldExit()
                        && juce::Time::getMillisecondCounterHiRes() - started < deadline) juce::Thread::sleep (25);
                    if (child.isRunning())
                    {
                        child.kill();
                        result = failure ("Export interrupted. Inspect the local export journal before retrying.");
                    }
                    else
                    {
                        result = juce::JSON::parse (folder.getChildFile ("response.json").loadFileAsString());
                        if (! result.isObject()) result = failure ("The track export helper returned no result.");
                        else if (request["operation"].toString().startsWith ("export") && (bool) result["ok"])
                        {
                            const auto file = folder.getChildFile ("selection.orb-regions.zip");
                            juce::MemoryBlock bytes;
                            if (file.getSize() <= 0 || file.getSize() > 300LL * 1024 * 1024 || ! file.loadFileAsData (bytes))
                                result = failure ("The track archive is missing or exceeds 300 MB.");
                            else result.getDynamicObject()->setProperty ("data", juce::Base64::toBase64 (bytes.getData(), bytes.getSize()));
                        }
                    }
                }
                else result = failure ("Could not start the Slur track export helper.");
            }
        }
        if (! shouldExit())
            juce::MessageManager::callAsync ([completion = std::move (done), result = juce::JSON::toString (result, true), life = alive] {
                if (auto owner = life.lock(); owner && owner->load()) completion (juce::var (result));
            });
        return jobHasFinished;
    }
private:
    juce::var request;
    juce::WebBrowserComponent::NativeFunctionCompletion done;
    std::weak_ptr<std::atomic_bool> alive;
};
}
void TrackExportBridge::invoke (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion done)
{
    auto reject = [&done] (const juce::String& message) { done (juce::JSON::toString (failure (message), true)); };
    if (! args.isArray() || args.size() < 1 || args.size() > 3) { reject ("Invalid track export request."); return; }
    const auto op = args[0].toString();
    if (op != "inspectTracks" && op != "exportTracks" && op != "inspectLunaTracks" && op != "exportLunaTracks")
        { reject ("Unknown track export operation."); return; }
    if (pool.getNumJobs() != 0) { reject ("Another track export is running."); return; }
    auto* input = new juce::DynamicObject();
    input->setProperty ("operation", op);
    if (op.startsWith ("export"))
    {
        const auto options = args.size() == 3 ? juce::JSON::parse (args[2].toString()) : juce::var();
        if (! options.isObject()) { delete input; reject ("Invalid track export options."); return; }
        input->setProperty ("sessionId", args[1].toString()); input->setProperty ("options", options);
    }
    pool.addJob (new ExportJob (juce::var (input), std::move (done), alive), true);
}
