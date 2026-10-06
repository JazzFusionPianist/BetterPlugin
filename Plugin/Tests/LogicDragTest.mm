// Standalone native regression test; no input events are sent to the desktop.
// xcrun clang++ -std=c++17 -fobjc-arc -framework AppKit -framework WebKit \
//   Plugin/Tests/LogicDragTest.mm -o /tmp/orb-logic-drag-test
#include "../Source/DragMonitor.mm"
#include <cassert>
#include <iostream>

static NSUInteger testButtons = 0;
static NSUInteger pressedButtons(id, SEL) { return testButtons; }

int main()
{
    @autoreleasepool {
        Method buttons = class_getClassMethod(NSEvent.class, @selector(pressedMouseButtons));
        IMP original = method_setImplementation(buttons, (IMP)pressedButtons);
        {
            DragMonitor monitor;
            int cancelled = 0;
            monitor.armRegionAction("late", [&](double, double, bool cancel) {
                assert(cancel); ++cancelled;
            });
            assert(cancelled == 1 && !gDragHelper.regionAction && !gDragHelper.monitor);

            testButtons = 1;
            gDragHelper.isDragging = YES;
            monitor.armRegionAction("overlapping", [&](double, double, bool cancel) {
                assert(cancel); ++cancelled;
            });
            assert(cancelled == 2 && gDragHelper.isDragging);
            gDragHelper.isDragging = NO;
        }
        method_setImplementation(buttons, original);

        JuceDragHelper* helper = [JuceDragHelper new];
        __block int notifications = 0;
        helper.regionToken = @"pending";
        helper.regionAction = ^(double, double, bool cancel) { assert(cancel); ++notifications; };
        [helper cancelPendingRegionAction];
        assert(notifications == 1 && !helper.regionAction && !helper.regionToken);
        [helper cancelPendingRegionAction];
        assert(notifications == 1);

        helper.regionToken = @"active";
        helper.regionAction = ^(double, double, bool cancel) { assert(cancel); ++notifications; };
        helper.isDragging = YES;
        [helper cancelPendingRegionAction];
        assert(notifications == 1 && helper.regionAction && helper.isDragging);

        helper.regionCancelled = YES;
        [helper draggingSession:nil endedAtPoint:NSZeroPoint operation:NSDragOperationNone];
        assert(notifications == 2 && !helper.regionAction && !helper.isDragging);
        std::cout << "6 native Logic drag lifecycle checks passed\n";
    }
}
