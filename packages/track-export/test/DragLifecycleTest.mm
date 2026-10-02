// Exercise native drag ownership without opening windows or synthesizing input.
#include "../../../Plugin/Source/DragMonitor.mm"
#include <cassert>
#include <cstdio>
int main() { @autoreleasepool {
    JuceDragHelper* helper = [JuceDragHelper new];
    helper.regionXml = @"active region payload";
    helper.filePaths = @[@"/synthetic/original.wav"];
    helper.isDragging = YES;
    helper.sessionStarted = YES;
    assert(![helper armWithPaths:@[@"/synthetic/late.wav"]]);
    assert(helper.isDragging && helper.sessionStarted);
    assert([helper.regionXml isEqualToString:@"active region payload"]);
    assert([helper.filePaths.firstObject isEqualToString:@"/synthetic/original.wav"]);
    // Mouse-up clears the monitor but does not end the native drag.
    [helper disarm];
    assert(helper.isDragging);
    assert(helper.regionXml == nil && helper.filePaths.count == 0);
    [helper draggingSession:nil endedAtPoint:NSZeroPoint operation:NSDragOperationNone];
    assert(!helper.isDragging && !helper.sessionStarted && helper.monitor == nil);
    puts("all checks passed");
} }
