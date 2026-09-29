#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include "DeviceKeychain.h"

namespace {
NSString* serviceName() { return @"com.musicatstudio.slur.chat-recovery"; }
NSString* ns (const juce::String& value) { return [NSString stringWithUTF8String:value.toRawUTF8()]; }

NSMutableDictionary* baseQuery (const juce::String& user)
{
    return [@{ (__bridge id) kSecClass: (__bridge id) kSecClassGenericPassword,
               (__bridge id) kSecAttrService: serviceName(),
               (__bridge id) kSecAttrAccount: ns (user),
               (__bridge id) kSecAttrSynchronizable: @NO } mutableCopy];
}
}

namespace orb::deviceKeychain {
bool store (const juce::String& user, const juce::String& recoveryCode)
{
    auto* query = baseQuery (user);
    NSData* data = [ns (recoveryCode) dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary* update = @{ (__bridge id) kSecValueData: data,
                              (__bridge id) kSecAttrAccessible: (__bridge id) kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly };
    auto status = SecItemUpdate ((__bridge CFDictionaryRef) query, (__bridge CFDictionaryRef) update);
    if (status == errSecItemNotFound)
    {
        [query addEntriesFromDictionary:update];
        status = SecItemAdd ((__bridge CFDictionaryRef) query, nullptr);
    }
    return status == errSecSuccess;
}

std::optional<juce::String> load (const juce::String& user)
{
    auto* query = baseQuery (user);
    query[(__bridge id) kSecReturnData] = @YES;
    query[(__bridge id) kSecMatchLimit] = (__bridge id) kSecMatchLimitOne;
    CFTypeRef result = nullptr;
    const auto status = SecItemCopyMatching ((__bridge CFDictionaryRef) query, &result);
    if (status == errSecItemNotFound) return std::nullopt;
    if (status != errSecSuccess || result == nullptr) return std::nullopt;
    NSData* data = CFBridgingRelease (result);
    NSString* value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (value == nil) return std::nullopt;
    return juce::String::fromUTF8 (value.UTF8String);
}

bool remove (const juce::String& user)
{
    const auto status = SecItemDelete ((__bridge CFDictionaryRef) baseQuery (user));
    return status == errSecSuccess || status == errSecItemNotFound;
}
}
