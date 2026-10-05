import AppKit
import ApplicationServices

enum BridgeFailure: Error, LocalizedError {
    case message(String)
    var errorDescription: String? {
        if case .message(let value) = self { return value }
        return nil
    }
}

func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw BridgeFailure.message(message) }
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}

func string(_ element: AXUIElement, _ name: String) -> String {
    let value = attribute(element, name)
    if let text = value as? String { return text }
    if let url = value as? URL { return url.absoluteString }
    return ""
}

func elements(_ element: AXUIElement, _ name: String = kAXChildrenAttribute) -> [AXUIElement] {
    attribute(element, name) as? [AXUIElement] ?? []
}

func descendants(_ root: AXUIElement) throws -> [AXUIElement] {
    var result: [AXUIElement] = []
    var pending: [(AXUIElement, Int)] = [(root, 0)]
    while let (element, depth) = pending.popLast() {
        try require(result.count < 20000 && depth < 64, "Logic's accessibility tree exceeds the inspection limit.")
        result.append(element)
        pending.append(contentsOf: elements(element).reversed().map { ($0, depth + 1) })
    }
    return result
}

func describe(_ element: AXUIElement) -> [String: Any] {
    var result: [String: Any] = [:]
    for name in [kAXRoleAttribute, kAXSubroleAttribute, kAXRoleDescriptionAttribute, kAXTitleAttribute,
                 kAXDescriptionAttribute, kAXHelpAttribute, kAXIdentifierAttribute] {
        let value = string(element, name)
        if !value.isEmpty { result[name] = value }
    }
    for name in [kAXSelectedAttribute, kAXEnabledAttribute, kAXValueAttribute] {
        if let value = attribute(element, name) as? NSNumber { result[name] = value }
        else if let value = attribute(element, name) as? String { result[name] = value }
    }
    return result
}

func press(_ element: AXUIElement) throws {
    try require(AXUIElementPerformAction(element, kAXPressAction as CFString) == .success, "Logic did not accept the requested control.")
}

func setText(_ element: AXUIElement, _ text: String) throws {
    try require(AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFString) == .success,
                "Logic's file dialog is not editable.")
}

func waitFor<T>(_ description: String, seconds: TimeInterval = 8, _ read: () throws -> T?) throws -> T {
    let end = Date().addingTimeInterval(seconds)
    while Date() < end {
        if let result = try read() { return result }
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    throw BridgeFailure.message("Timed out: \(description). Inspect Logic before retrying.")
}

struct LogicContext {
    let application: NSRunningApplication
    let root: AXUIElement
    let window: AXUIElement
    let document: String

    init(expectedDocument: String? = nil) throws {
        try require(AXIsProcessTrusted(), "Enable Orb Logic Bridge in System Settings > Privacy & Security > Accessibility, then inspect again.")
        let applications = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.logic10")
        try require(applications.count == 1, "Open exactly one Logic Pro application before connecting.")
        application = applications[0]
        root = AXUIElementCreateApplication(application.processIdentifier)
        AXUIElementSetMessagingTimeout(root, 2)
        let candidates = elements(root, kAXWindowsAttribute).filter {
            let document = string($0, kAXDocumentAttribute)
            return document.contains(".logicx") && string($0, kAXRoleAttribute) == kAXWindowRole
        }
        try require(candidates.count == 1, "Keep exactly one saved Logic project window open for this transfer.")
        window = candidates[0]
        document = string(window, kAXDocumentAttribute)
        try require(expectedDocument == nil || expectedDocument == document, "The current Logic project changed. Transfer stopped.")
    }

    func inspect() throws -> [String: Any] {
        let nodes = try descendants(window)
        let transport = nodes.filter {
            [kAXCheckBoxRole, kAXButtonRole].contains(string($0, kAXRoleAttribute)) &&
                (["Play", "Record"].contains(string($0, kAXDescriptionAttribute)) || ["Play", "Record"].contains(string($0, kAXTitleAttribute)))
        }
        try require(transport.count == 2, "This Logic transport layout/language is not qualified yet.")
        try require(transport.allSatisfy { (attribute($0, kAXValueAttribute) as? NSNumber)?.intValue == 0 },
                    "Stop playback and recording before transferring regions.")
        var tracks: [[String: Any]] = []
        // Keep the host's region identities and selection flags, not filename or
        // playhead guesses. AAF supplies sample-accurate timing in the next stage.
        for node in nodes where string(node, kAXRoleDescriptionAttribute).lowercased() == "track background" {
            let regionNodes = try descendants(node).filter {
                string($0, kAXRoleDescriptionAttribute).lowercased() == "region"
            }
            var track = describe(node)
            track["regions"] = regionNodes.map(describe)
            tracks.append(track)
        }
        try require(!tracks.isEmpty, "No accessible Tracks-area regions. Open Logic's Tracks area.")
        return ["version": 1, "pid": application.processIdentifier, "projectId": document,
                "projectName": string(window, kAXTitleAttribute), "tracks": tracks,
                "capturedAt": ISO8601DateFormatter().string(from: Date())]
    }

    func checkProject() throws {
        _ = try LogicContext(expectedDocument: document)
    }

    func checkDrop(_ point: [Double]) throws {
        try require(point.count == 2 && point.allSatisfy { $0.isFinite && abs($0) < 100000 }, "Invalid drop coordinates.")
        var hit: AXUIElement?
        try require(AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), Float(point[0]), Float(point[1]), &hit) == .success,
                    "Drop onto Logic's Tracks area, not the plug-in or another window.")
        guard var element = hit else { throw BridgeFailure.message("No Logic drop target.") }
        var pid: pid_t = 0
        try require(AXUIElementGetPid(element, &pid) == .success && pid == application.processIdentifier,
                    "The drop target is not Logic Pro.")
        guard let targetWindow = attribute(element, kAXWindowAttribute) else { throw BridgeFailure.message("No Logic project at the drop point.") }
        try require(CFEqual(targetWindow, window), "Drop onto the same project used to prepare this bundle.")
        for _ in 0..<32 {
            if ["track background", "region"].contains(string(element, kAXRoleDescriptionAttribute).lowercased()) { return }
            guard let parent = attribute(element, kAXParentAttribute), CFGetTypeID(parent) == AXUIElementGetTypeID() else { break }
            element = unsafeBitCast(parent, to: AXUIElement.self)
        }
        throw BridgeFailure.message("Drop onto a track lane in Logic's Tracks area.")
    }

    func hasFocus() -> Bool {
        // Query the host directly; NSWorkspace activation state can lag while
        // a synchronous transfer pumps a nested run loop.
        (attribute(root, kAXFrontmostAttribute) as? NSNumber)?.boolValue == true
    }

    func key(_ code: CGKeyCode, flags: CGEventFlags = []) throws {
        try checkProject()
        try require(hasFocus(),
                    "Logic lost focus. No keys were sent.")
        try require((code == 5 && flags == [.maskCommand, .maskShift]) || (code == 36 && flags.isEmpty),
                    "Unsupported file-dialog key.")
        guard let focused = attribute(root, kAXFocusedWindowAttribute),
              CFGetTypeID(focused) == AXUIElementGetTypeID() else {
            throw BridgeFailure.message("No focused Logic file dialog.")
        }
        let focusedWindow = unsafeBitCast(focused, to: AXUIElement.self)
        let identifiers = try descendants(focusedWindow).map { string($0, kAXIdentifierAttribute) }
        try require(identifiers.contains(where: { ["save-panel", "open-panel", "GoToWindow", "PathTextField"].contains($0) }),
                    "Logic's file dialog lost focus. No keys were sent.")
        // AX exposes the panel before AppKit finishes assigning its key window.
        // Raise that exact panel, then recheck focus after the transition settles.
        try require(AXUIElementPerformAction(focusedWindow, kAXRaiseAction as CFString) == .success,
                    "Cannot focus Logic's file dialog.")
        RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        try require(hasFocus(), "Logic lost focus to \(NSWorkspace.shared.frontmostApplication?.localizedName ?? "an unknown application"). No keys were sent.")
        try require(CGPreflightPostEventAccess(), "Keyboard control is not approved for Orb Logic Bridge in Accessibility settings.")
        guard let source = CGEventSource(stateID: .hidSystemState) else {
            throw BridgeFailure.message("Could not create file-dialog event source.")
        }
        func send(_ key: CGKeyCode, _ down: Bool) throws {
            if down {
                try checkProject()
                try require(hasFocus(), "Logic lost focus. No keys were sent.")
                guard let current = attribute(root, kAXFocusedWindowAttribute) else {
                    throw BridgeFailure.message("Logic's file dialog lost focus.")
                }
                try require(CFEqual(current, focusedWindow), "Logic's file dialog changed. Transfer stopped.")
            }
            guard let event = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: down) else {
                throw BridgeFailure.message("Could not create Logic key event.")
            }
            if key == 55 || key == 56 { event.type = .flagsChanged }
            event.flags = key == 55 ? (down ? .maskCommand : [])
                : key == 56 ? (down ? [.maskCommand, .maskShift] : .maskCommand) : flags
            event.post(tap: .cghidEventTap)
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        if code == 5 {
            defer {
                try? send(56, false)
                try? send(55, false)
            }
            try send(55, true)
            try send(56, true)
            try send(code, true)
            try send(code, false)
        } else {
            try send(code, true)
            try send(code, false)
        }
        try require(hasFocus(), "Logic lost focus. Transfer stopped.")
    }

    func findIdentifier(_ identifier: String) throws -> AXUIElement? {
        try descendants(root).first { string($0, kAXIdentifierAttribute) == identifier }
    }

    func blockingDialogs() throws -> [AXUIElement] {
        try descendants(root).filter { node in
            if string(node, kAXRoleAttribute) == kAXSheetRole { return true }
            guard ["AXDialog", "AXSystemDialog"].contains(string(node, kAXSubroleAttribute)) else { return false }
            // Logic exposes its floating AU editor as AXDialog, even though it
            // is nonmodal. Keep file dialogs/settings blocked while Orb is open.
            if (attribute(node, kAXModalAttribute) as? NSNumber)?.boolValue == false {
                let isOrbEditor = try descendants(node).contains {
                    string($0, kAXRoleAttribute) == kAXGroupRole &&
                        (["Orb Chat", "Orb Logic QA"].contains(string($0, kAXTitleAttribute)) ||
                         ["Orb Chat", "Orb Logic QA"].contains(string($0, kAXDescriptionAttribute)))
                }
                if isOrbEditor { return false }
            }
            return true
        }
    }

    func menu(_ path: [String]) throws {
        _ = try inspect()
        let panels = try blockingDialogs()
        let panelNames = panels.map { node in
            let title = string(node, kAXTitleAttribute)
            let groups = ((try? descendants(node)) ?? []).filter { string($0, kAXRoleAttribute) == kAXGroupRole }
                .map { string($0, kAXDescriptionAttribute) }.filter { !$0.isEmpty }.prefix(4)
            return "\(title.isEmpty ? string(node, kAXSubroleAttribute) : title) [\(groups.joined(separator: ", "))]"
        }
        try require(panels.isEmpty, "Close existing Logic dialogs before transferring: \(panelNames.joined(separator: "; ")).")
        try checkProject()
        application.activate(options: [])
        if !hasFocus() {
            try require(AXUIElementSetAttributeValue(root, kAXFrontmostAttribute as CFString, kCFBooleanTrue) == .success,
                        "Activate Logic Pro before transferring regions.")
        }
        let _: Bool = try waitFor("Logic focus") {
            hasFocus() ? true : nil
        }
        guard let bar = attribute(root, kAXMenuBarAttribute) else { throw BridgeFailure.message("Logic menu bar unavailable.") }
        var parent = unsafeBitCast(bar, to: AXUIElement.self)
        for label in path {
            try checkProject()
            let node: AXUIElement = try waitFor("Logic menu \(label)") {
                let matches = try descendants(parent).filter { string($0, kAXTitleAttribute) == label }
                try require(matches.count <= 1, "Ambiguous Logic menu item: \(label).")
                return matches.first
            }
            try press(node)
            parent = node
        }
    }

    func goTo(_ path: String) throws {
        try key(5, flags: [.maskCommand, .maskShift])
        let field: AXUIElement = try waitFor("Go to Folder") { try findIdentifier("PathTextField") }
        try setText(field, path)
        try key(36)
        let _: Bool = try waitFor("Go to Folder completion") { try findIdentifier("PathTextField") == nil ? true : nil }
    }

    func exportAAF(to destination: URL, sampleRate: Int) throws {
        let rates = [44100: "44.1 kHz", 48000: "48 kHz", 88200: "88.2 kHz", 96000: "96 kHz", 176400: "176.4 kHz", 192000: "192 kHz"]
        guard let rateLabel = rates[sampleRate] else { throw BridgeFailure.message("Unqualified Logic export sample rate.") }
        try require(!FileManager.default.fileExists(atPath: destination.path), "Export destination already exists.")
        try menu(["File", "Export", "Project as AAF File\u{2026}"])
        let panel: AXUIElement = try waitFor("AAF save dialog") { try findIdentifier("save-panel") }
        // Export 24-bit WAV without dithering; never silently use lossy formats.
        for (label, choice) in [("Sample Rate:", rateLabel), ("Bit Depth:", "24-bit"), ("File Type:", "WAVE"), ("Dither Type:", "None")] {
            let nodes = try descendants(panel)
            guard let index = nodes.firstIndex(where: {
                string($0, kAXValueAttribute).hasSuffix(label) || string($0, kAXTitleAttribute).hasSuffix(label)
            }), let popup = nodes.dropFirst(index + 1).first(where: { string($0, kAXRoleAttribute) == kAXPopUpButtonRole }) else {
                throw BridgeFailure.message("Unrecognized Logic AAF export options.")
            }
            let selected = { string(popup, kAXTitleAttribute) == choice || string(popup, kAXValueAttribute) == choice }
            if selected() { continue }
            try press(popup)
            let item: AXUIElement = try waitFor(choice) {
                try descendants(root).first { string($0, kAXRoleAttribute) == kAXMenuItemRole && string($0, kAXTitleAttribute) == choice }
            }
            try press(item)
            let _: Bool = try waitFor("AAF option \(choice)") { selected() ? true : nil }
        }
        try goTo(destination.deletingLastPathComponent().path)
        guard let field = try findIdentifier("saveAsNameTextField"), let save = try findIdentifier("OKButton") else {
            throw BridgeFailure.message("AAF save dialog changed.")
        }
        try setText(field, destination.lastPathComponent)
        try checkProject()
        try press(save)
        var previousSize: UInt64 = 0
        var stableSince = Date()
        let _: Bool = try waitFor("Logic AAF export", seconds: 120) {
            try checkProject()
            guard let attributes = try? FileManager.default.attributesOfItem(atPath: destination.path),
                  let size = attributes[.size] as? UInt64, size > 0, try findIdentifier("save-panel") == nil else { return nil }
            if size != previousSize { previousSize = size; stableSince = Date() }
            return Date().timeIntervalSince(stableSince) > 1 ? true : nil
        }
    }

    func importAAF(from source: URL) throws {
        try require(FileManager.default.fileExists(atPath: source.path), "Missing prepared Logic AAF.")
        try menu(["File", "Import", "AAF\u{2026}"])
        let _: AXUIElement = try waitFor("AAF open dialog") { try findIdentifier("open-panel") }
        try goTo(source.path)
        guard let open = try findIdentifier("OKButton") else { throw BridgeFailure.message("AAF open dialog changed.") }
        try checkProject()
        try press(open)
        // Logic may ask where to copy its audio. Leave unfamiliar dialogs to the
        // user instead of accepting a guessed destination or replacing a file.
        let _: Bool = try waitFor("Logic AAF import", seconds: 120) {
            try checkProject()
            let dialogs = try descendants(root).filter {
                string($0, kAXIdentifierAttribute) == "open-panel" || string($0, kAXIdentifierAttribute) == "save-panel"
            }
            let blocked = try blockingDialogs()
            return dialogs.isEmpty && blocked.isEmpty ? true : nil
        }
    }
}

final class BridgeApp: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var output: NSTextView!
    var processing = false
    let jobs = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Orb/DawBridge/Jobs")

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 610, height: 440),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Orb Logic Bridge"
        window.center()
        let content = NSStackView()
        content.orientation = .vertical
        content.alignment = .leading
        content.spacing = 16
        content.translatesAutoresizingMaskIntoConstraints = false
        window.contentView!.addSubview(content)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 20),
            content.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -20),
            content.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 20),
            content.bottomAnchor.constraint(equalTo: window.contentView!.bottomAnchor, constant: -20)
        ])
        let title = NSTextField(labelWithString: "Logic Pro Connection")
        title.font = .boldSystemFont(ofSize: 20)
        content.addArrangedSubview(title)
        let explanation = NSTextField(wrappingLabelWithString:
            "Orb uses Accessibility to read selected regions and control Logic Pro's AAF dialogs. Only Logic Pro is targeted. Audio and inspection data stay on this Mac until you send a bundle in Orb Chat. Approve access yourself in System Settings.")
        content.addArrangedSubview(explanation)
        let buttons = NSStackView()
        buttons.orientation = .horizontal
        for (label, selector) in [("Accessibility Settings", #selector(accessibility)), ("Inspect Selection", #selector(inspect))] {
            let button = NSButton(title: label, target: self, action: selector)
            button.bezelStyle = .rounded
            buttons.addArrangedSubview(button)
        }
        content.addArrangedSubview(buttons)
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        output = NSTextView()
        output.isEditable = false
        output.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        output.isVerticallyResizable = true
        output.autoresizingMask = [.width]
        scroll.documentView = output
        content.addArrangedSubview(scroll)
        scroll.widthAnchor.constraint(equalTo: content.widthAnchor).isActive = true
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 200).isActive = true
        output.string = AXIsProcessTrusted() ? "Access enabled. Select audio regions in Logic and inspect." : "Accessibility access has not been granted."
        let folders = (try? FileManager.default.contentsOfDirectory(at: jobs, includingPropertiesForKeys: nil)) ?? []
        let pending = folders.contains {
            FileManager.default.fileExists(atPath: $0.appendingPathComponent("logic-request.json").path)
                && !FileManager.default.fileExists(atPath: $0.appendingPathComponent("logic-started.json").path)
        }
        if !pending {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.processJobs() }
    }

    @objc func accessibility() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!)
    }

    @objc func inspect() {
        do {
            let report = try LogicContext().inspect()
            let bytes = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            let directory = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Library/Application Support/Orb/DawBridge/Logic")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                   attributes: [.posixPermissions: 0o700])
            try bytes.write(to: directory.appendingPathComponent("Last Inspection.json"), options: .atomic)
            output.string = String(decoding: bytes, as: UTF8.self)
        } catch { output.string = error.localizedDescription }
    }

    func processJobs() {
        guard !processing, let folders = try? FileManager.default.contentsOfDirectory(at: jobs, includingPropertiesForKeys: nil) else { return }
        for folder in folders where UUID(uuidString: folder.lastPathComponent) != nil ||
            (folder.lastPathComponent.count == 32 && folder.lastPathComponent.allSatisfy { $0.isHexDigit }) {
            let requestURL = folder.appendingPathComponent("logic-request.json")
            let responseURL = folder.appendingPathComponent("logic-response.json")
            let startedURL = folder.appendingPathComponent("logic-started.json")
            guard FileManager.default.fileExists(atPath: requestURL.path),
                  !FileManager.default.fileExists(atPath: responseURL.path),
                  !FileManager.default.fileExists(atPath: startedURL.path) else { continue }
            processing = true
            defer { processing = false }
            var response: [String: Any]
            do {
                try require(folder.resolvingSymlinksInPath().deletingLastPathComponent() == jobs.resolvingSymlinksInPath(), "Invalid Logic job directory.")
                let bytes = try Data(contentsOf: requestURL)
                try require(bytes.count <= 16384, "Logic request exceeds its limit.")
                guard let request = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
                      let operation = request["operation"] as? String else { throw BridgeFailure.message("Invalid Logic request.") }
                try require(["inspect", "captureAAF", "importAAF", "readbackAAF", "checkDrop"].contains(operation), "Unknown Logic operation.")
                guard let expiry = request["expiresAt"] as? Double else { throw BridgeFailure.message("Missing Logic operation deadline.") }
                try require(Date().timeIntervalSince1970 * 1000 < expiry, "Logic request expired before it started. No action taken.")
                try Data("{\"started\":true}".utf8).write(to: startedURL, options: .withoutOverwriting)
                let context = try LogicContext(expectedDocument: request["projectId"] as? String)
                let before = try context.inspect()
                try JSONSerialization.data(withJSONObject: before).write(to: folder.appendingPathComponent("before.json"), options: .atomic)
                if operation != "inspect" {
                    try require(request["projectId"] as? String == context.document, "Explicit current project identity required.")
                    if operation == "checkDrop" {
                        guard let point = request["point"] as? [Double] else { throw BridgeFailure.message("Missing drop point.") }
                        try context.checkDrop(point)
                    } else if operation == "importAAF" {
                        try context.importAAF(from: folder.appendingPathComponent("Orb-regions.aaf"))
                    } else {
                        guard let rate = request["sampleRate"] as? Int else { throw BridgeFailure.message("Missing native project sample rate.") }
                        try context.exportAAF(to: folder.appendingPathComponent("Logic-export.aaf"), sampleRate: rate)
                    }
                }
                let after = try context.inspect()
                try JSONSerialization.data(withJSONObject: after).write(to: folder.appendingPathComponent("after.json"), options: .atomic)
                response = ["ok": true, "snapshot": after]
            } catch { response = ["ok": false, "error": error.localizedDescription] }
            do {
                let bytes = try JSONSerialization.data(withJSONObject: response, options: [.prettyPrinted, .sortedKeys])
                try bytes.write(to: responseURL, options: .atomic)
                output.string = String(decoding: bytes, as: UTF8.self)
            } catch { output.string = error.localizedDescription }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = BridgeApp()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
