#import <Foundation/Foundation.h>
#include "../../../Plugin/Source/VstXmlDrop.h"
#include <cassert>
int main() { @autoreleasepool {
    NSString* prefix = @"<vst-xml version='1.3'><sourceApp>Cubase</sourceApp><region id='1' channelID='track'>";
    NSString* body = @"<name>A &amp; B</name><filename>/tmp/a&amp;b.wav</filename><start>24</start><end>48</end><projectTime domain='seconds'>2.5</projectTime>";
    NSString* suffix = @"</region></vst-xml>";
    NSString* good = [NSString stringWithFormat:@"%@%@%@", prefix, body, suffix];
    NSArray* r = slurVstXmlRegions(good);
    assert(r.count == 1);
    assert([r[0][@"metadata"][@"name"] isEqual:@"A & B"]);
    assert([r[0][@"metadata"][@"lengthFrames"] intValue] == 24);
    assert([r[0][@"metadata"][@"positionSeconds"] doubleValue] == 2.5);
    assert([r[0][@"url"] isFileURL]);
    for (NSArray* change in @[
        @[@"<start>24</start>", @"<start>-1</start>"],
        @[@"<end>48</end>", @"<end>20</end>"],
        @[@"/tmp/a&amp;b.wav", @"https://evil.test/file.wav"],
        @[@"/tmp/a&amp;b.wav", @"/tmp/secret.txt"],
        @[@"</region>", @"<loop><start>0</start><end>4</end></loop></region>"],
        @[@"</region>", @"<filename>/tmp/extra.wav</filename></region>"],
        @[@"domain='seconds'", @"domain='unknown'"],
        @[@"2.5</projectTime>", @"NaN</projectTime>"],
        @[@"<region id=", @"<region type='join' id="],
    ]) assert(slurVstXmlRegions([good stringByReplacingOccurrencesOfString:change[0] withString:change[1]]) == nil);
    assert(slurVstXmlRegions([@"<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///private/x'>]>" stringByAppendingString:good]) == nil);
    auto beats = slurVstXmlRegions([good stringByReplacingOccurrencesOfString:@"domain='seconds'" withString:@"domain='quarterNotes'"]);
    assert(beats.count == 1 && beats[0][@"metadata"][@"positionSeconds"] == NSNull.null);
    puts("VST XML native parser: all checks passed");
} }
