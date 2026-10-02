#pragma once
#import <Foundation/Foundation.h>
#include <cmath>

// Native drag payload only. Never resolve entities, URLs or joined segments.
// nil means malformed/unsupported; an empty result is not a successful drop.
static NSArray<NSDictionary*>* slurVstXmlRegions(NSString* xml)
{
    if (!xml || xml.length > 1024 * 1024 || [xml containsString:@"<!DOCTYPE"]
        || [xml containsString:@"<!ENTITY"]) return nil;
    NSError* error = nil;
    NSXMLDocument* doc = [[NSXMLDocument alloc] initWithXMLString:xml
        options:NSXMLNodeLoadExternalEntitiesNever error:&error];
    NSXMLElement* root = doc.rootElement;
    if (error || ![root.name isEqualToString:@"vst-xml"]) return nil;
    if (![@[@"1.0", @"1.1", @"1.2", @"1.3", @"1.4"] containsObject:[root attributeForName:@"version"].stringValue ?: @""]) return nil;
    for (NSXMLNode* child in root.children)
        if (child.kind == NSXMLElementKind && ![@[@"sourceApp", @"region"] containsObject:child.name]) return nil;
    NSArray* sources = [root elementsForName:@"sourceApp"];
    NSArray<NSXMLElement*>* regions = [root elementsForName:@"region"];
    if (sources.count != 1 || regions.count == 0 || regions.count > 512) return nil;
    NSString* source = [sources[0] stringValue];
    if (!source.length || source.length > 512) return nil;
    NSString* capture = NSUUID.UUID.UUIDString;
    NSMutableArray* result = [NSMutableArray array];
    NSMutableSet* ids = [NSMutableSet set];
    NSSet* allowed = [NSSet setWithArray:@[@"name", @"filename", @"start", @"end", @"projectTime", @"color", @"tempo", @"signature", @"rootkey"]];
    for (NSXMLElement* r in regions) {
        NSString* ident = [r attributeForName:@"id"].stringValue;
        if (!ident.length || [ids containsObject:ident] || [r attributeForName:@"type"]) return nil;
        [ids addObject:ident];
        for (NSXMLNode* child in r.children)
            if (child.kind == NSXMLElementKind && ![allowed containsObject:child.name]) return nil;
        for (NSString* key in allowed) if ([r elementsForName:key].count > 1) return nil;
        NSString* (^leaf)(NSString*) = ^NSString*(NSString* key) {
            NSXMLElement* node = [r elementsForName:key].firstObject;
            for (NSXMLNode* c in node.children) if (c.kind == NSXMLElementKind) return nil;
            return node.stringValue;
        };
        NSString* path = leaf(@"filename");
        if (!path.isAbsolutePath || [path hasPrefix:@"//"] || path.length > 4096
            || ![@[@"wav", @"wave"] containsObject:path.pathExtension.lowercaseString]) return nil;
        NSString* start = leaf(@"start"), *end = leaf(@"end");
        NSCharacterSet* notDigits = [[NSCharacterSet characterSetWithCharactersInString:@"0123456789"] invertedSet];
        if (!start.length || !end.length || [start rangeOfCharacterFromSet:notDigits].location != NSNotFound
            || [end rangeOfCharacterFromSet:notDigits].location != NSNotFound) return nil;
        double a = start.doubleValue, b = end.doubleValue;
        if (a < 0 || b <= a || b > 9007199254740991.0) return nil;
        id seconds = NSNull.null;
        NSXMLElement* time = [r elementsForName:@"projectTime"].firstObject;
        if (time) {
            NSString* value = leaf(@"projectTime");
            NSScanner* scan = [NSScanner scannerWithString:value ?: @""];
            double v = 0;
            if (![scan scanDouble:&v] || !scan.isAtEnd || !std::isfinite(v) || v < 0) return nil;
            NSString* domain = [time attributeForName:@"domain"].stringValue;
            if ([domain isEqualToString:@"seconds"]) seconds = @(v);
            else if (![domain isEqualToString:@"quarterNotes"]) return nil;
            // A tempo snapshot cannot convert quarterNotes through a tempo map.
        }
        NSString* channel = [r attributeForName:@"channelID"].stringValue;
        NSString* name = leaf(@"name");
        if (channel.length > 128 || name.length > 512) return nil;
        NSDictionary* metadata = @{@"format": @"vst-xml", @"version": @1,
            @"captureId": capture, @"sourceApp": source,
            @"channelId": channel.length ? (id)channel : NSNull.null,
            @"name": name.length ? name : path.lastPathComponent,
            @"offsetFrames": @(a), @"lengthFrames": @(b-a), @"positionSeconds": seconds};
        [result addObject:@{@"url": [NSURL fileURLWithPath:path], @"metadata": metadata}];
    }
    return result;
}
