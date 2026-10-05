// Exercise native drag ownership without opening windows or synthesizing input.
#include "../../../Plugin/Source/DragMonitor.mm"
#include <cassert>
#include <cstdio>
@interface DropInfoFixture : NSObject
@property(nonatomic, strong) NSPasteboard* draggingPasteboard;
@end
@implementation DropInfoFixture
@end
static NSDragOperation rejectWebDrop(id, SEL, id) { return NSDragOperationNone; }
static BOOL rejectWebPrepare(id, SEL, id) { return NO; }
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

    // Only an attached Slur receiver overrides WebKit's default rejection.
    gOrigDraggingEntered = (IMP)rejectWebDrop;
    gOrigDraggingUpdated = (IMP)rejectWebDrop;
    gOrigPrepareDragOp = (IMP)rejectWebPrepare;
    NSObject* target = [NSObject new];
    DropInfoFixture* info = [DropInfoFixture new];
    info.draggingPasteboard = [NSPasteboard pasteboardWithUniqueName];
    [info.draggingPasteboard writeObjects:@[[NSURL fileURLWithPath:@"/synthetic/region.wav"]]];
    id<NSDraggingInfo> drag = (id<NSDraggingInfo>)info;
    assert(orbDraggingEntered(target, @selector(draggingEntered:), drag) == NSDragOperationNone);
    objc_setAssociatedObject(target, &kDropCallbackKey, [JuceDropCallbackBox new], OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    assert(orbDraggingEntered(target, @selector(draggingEntered:), drag) == NSDragOperationCopy);
    assert(orbDraggingUpdated(target, @selector(draggingUpdated:), drag) == NSDragOperationCopy);
    assert(orbPrepareDragOp(target, @selector(prepareForDragOperation:), drag));
    [info.draggingPasteboard clearContents];
    [info.draggingPasteboard setString:@"unrelated text" forType:NSPasteboardTypeString];
    assert(orbDraggingEntered(target, @selector(draggingEntered:), drag) == NSDragOperationNone);
    assert(!orbPrepareDragOp(target, @selector(prepareForDragOperation:), drag));
    [info.draggingPasteboard releaseGlobally];
    puts("all checks passed");
} }
