#include "HostStemUploader.h"
#import <Foundation/Foundation.h>

void HostStemUploader::upload (const juce::File& file, const juce::String& uploadUrl,
                               const juce::String& contentType,
                               std::function<void (bool, juce::String)> completion)
{
    auto callback = std::make_shared<std::function<void (bool, juce::String)>> (std::move (completion));
    NSURL* remote = [NSURL URLWithString:[NSString stringWithUTF8String:uploadUrl.toRawUTF8()]];
    NSURL* local = [NSURL fileURLWithPath:[NSString stringWithUTF8String:file.getFullPathName().toRawUTF8()]];
    if (remote == nil || local == nil)
    {
        juce::MessageManager::callAsync ([callback] { (*callback) (false, "Invalid upload path"); });
        return;
    }

    NSMutableURLRequest* request = [NSMutableURLRequest requestWithURL:remote];
    request.HTTPMethod = @"PUT";
    [request setValue:[NSString stringWithUTF8String:contentType.toRawUTF8()]
   forHTTPHeaderField:@"Content-Type"];

    NSURLSessionUploadTask* task = [[NSURLSession sharedSession]
        uploadTaskWithRequest:request fromFile:local
        completionHandler:^(NSData*, NSURLResponse* response, NSError* error) {
            const auto status = [(NSHTTPURLResponse*) response statusCode];
            const bool ok = error == nil && status >= 200 && status < 300;
            juce::String message;
            if (error != nil) message = juce::String ([[error localizedDescription] UTF8String]);
            else if (! ok) message = "Upload failed (HTTP " + juce::String ((int) status) + ")";
            juce::MessageManager::callAsync ([callback, ok, message] { (*callback) (ok, message); });
        }];
    [task resume];
}
