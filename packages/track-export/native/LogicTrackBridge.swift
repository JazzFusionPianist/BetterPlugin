import AppKit
import ApplicationServices
import CryptoKit

enum Failure: Error, LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let s) = self { return s }; return nil }
}
func check(_ value: Bool, _ message: String) throws { if !value { throw Failure.message(message) } }
func attr(_ e: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(e, name as CFString, &value) == .success ? value : nil
}
func text(_ e: AXUIElement, _ name: String) -> String {
    if let s = attr(e, name) as? String { return s }
    if let u = attr(e, name) as? URL { return u.absoluteString }
    return ""
}
func children(_ e: AXUIElement, _ name: String = kAXChildrenAttribute) -> [AXUIElement] { attr(e, name) as? [AXUIElement] ?? [] }
func walk(_ e: AXUIElement) throws -> [AXUIElement] {
    var pending = [(e, 0)], result: [AXUIElement] = []
    while let (node, depth) = pending.popLast() {
        try check(result.count < 20000 && depth < 64, "Logic accessibility layout exceeds the safety limit.")
        result.append(node); pending += children(node).reversed().map { ($0, depth + 1) }
    }
    return result
}
func digest(_ s: String) -> String { SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined() }
func wait<T>(_ title: String, seconds: Double = 10, _ read: () throws -> T?) throws -> T {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        if let result = try read() { return result }
        RunLoop.current.run(until: Date().addingTimeInterval(0.08))
    }
    throw Failure.message("Timed out: \(title). Check Logic before retrying.")
}
func press(_ e: AXUIElement) throws {
    try check(AXUIElementPerformAction(e, kAXPressAction as CFString) == .success, "Logic did not accept the control.")
}
func value(_ e: AXUIElement, _ v: CFTypeRef) throws {
    try check(AXUIElementSetAttributeValue(e, kAXValueAttribute as CFString, v) == .success, "Logic control is not editable.")
}
func label(_ e: AXUIElement) -> String {
    let title = text(e, kAXTitleAttribute)
    return title.isEmpty ? text(e, kAXDescriptionAttribute) : title
}
struct Logic {
    let app: NSRunningApplication
    let root: AXUIElement
    let window: AXUIElement
    let document: String
    init() throws {
        try check(AXIsProcessTrusted(), "Allow Slur Track Bridge in System Settings → Privacy & Security → Accessibility, then refresh.")
        let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.logic10")
        try check(apps.count == 1, "Open one Logic Pro instance with a saved project.")
        app = apps[0]; root = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(root, 2)
        let windows = children(root, kAXWindowsAttribute).filter { text($0, kAXDocumentAttribute).contains(".logicx") }
        try check(windows.count == 1, "Keep exactly one saved Logic project window open.")
        window = windows[0]; document = text(window, kAXDocumentAttribute)
    }
    func headers() throws -> [AXUIElement] {
        let nodes = try walk(window).filter { text($0, kAXRoleAttribute) == "AXLayoutItem" && text($0, kAXDescriptionAttribute).range(of: #"^Track [0-9]+ “.+”$"#, options: .regularExpression) != nil }
        try check(!nodes.isEmpty, "Open Logic's Tracks area. This Logic layout/language is not supported yet.")
        return nodes
    }
    func inspect() throws -> [String: Any] {
        let nodes = try walk(window)
        for title in ["Play", "Record"] {
            let matches = nodes.filter { text($0, kAXRoleAttribute) == kAXCheckBoxRole && label($0) == title }
            try check(matches.count == 1 && (attr(matches[0], kAXValueAttribute) as? NSNumber)?.intValue == 0,
                      "Stop playback and recording in Logic before exporting.")
        }
        let h = try headers(), names = h.map { text($0, kAXDescriptionAttribute) }
        // These are snapshot-bound IDs, NOT persistent Logic track IDs. Reordering,
        // renaming, adding/removing tracks or changing region bounds invalidates them.
        let regions = nodes.filter { text($0, kAXRoleDescriptionAttribute).lowercased() == "region" }
            .map { text($0, kAXDescriptionAttribute) + text($0, kAXHelpAttribute) }
        let bounds = nodes.filter { ["Start Marker", "End Marker"].contains(label($0)) }
            .map { label($0) + String(describing: attr($0, kAXValueAttribute)) }
        let musical = nodes.filter { ["Tempo", "Time Signature"].contains(label($0)) }
            .map { label($0) + String(describing: attr($0, kAXValueAttribute)) }
        let revision = digest(([document] + names + regions + bounds + musical).joined(separator: "\n"))
        let tracks: [[String: Any]] = h.enumerated().map { index, node in
            let description = names[index]
            let name = String(description.split(separator: "“", maxSplits: 1).last!.dropLast())
            return ["id": "\(revision):\(index)", "name": name, "type": "Track",
                    "selected": (attr(node, kAXSelectedAttribute) as? NSNumber)?.boolValue ?? false,
                    "disabledReason": NSNull()]
        }
        return ["daw": "Logic Pro", "sessionId": digest(document), "revision": revision,
                "name": URL(string: document)?.deletingPathExtension().lastPathComponent ?? "Logic project",
                "sampleRate": NSNull(), "tracks": tracks,
                "ranges": ["entire": ["nativeLabel": "Project start → Project end"], "selection": NSNull()],
                "entireError": "", "rangeNote": "Logic: full project length, 24-bit WAV with track effects and volume/pan automation. Keep Logic unchanged while exporting. Cycle export is not yet enabled."]
    }
    func current(_ revision: String) throws {
        let now = try Logic()
        try check(now.document == document && (try now.inspect())["revision"] as? String == revision,
                  "Logic project or track layout changed. Refresh the track list.")
    }
    func foreground() throws {
        app.activate(options: [])
        _ = AXUIElementSetAttributeValue(root, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
        _ = try wait("Logic focus") { (attr(root, kAXFrontmostAttribute) as? NSNumber)?.boolValue == true ? true : nil }
    }
    func checkFocus() throws {
        try check((attr(root, kAXFrontmostAttribute) as? NSNumber)?.boolValue == true,
                  "Logic lost focus. Export stopped; return to Logic before retrying.")
    }
    func selectedIndices() throws -> [Int] {
        try headers().enumerated().filter { (attr($0.element, kAXSelectedAttribute) as? NSNumber)?.boolValue == true }.map { $0.offset }
    }
    func select(_ indices: [Int]) throws {
        try checkFocus()
        let h = try headers()
        try check(indices.allSatisfy { h.indices.contains($0) }, "Logic track disappeared.")
        guard let p = attr(h[0], kAXParentAttribute) else { throw Failure.message("No Logic track selection container.") }
        let parent = unsafeBitCast(p, to: AXUIElement.self)
        try check(AXUIElementSetAttributeValue(parent, kAXSelectedChildrenAttribute as CFString, indices.map { h[$0] } as CFArray) == .success,
                  "Logic refused track selection.")
        _ = try wait("Logic track selection") { try selectedIndices() == indices.sorted() ? true : nil }
    }
    func panels() throws -> [AXUIElement] {
        try walk(root).filter { text($0, kAXRoleAttribute) == kAXSheetRole
            || (text($0, kAXSubroleAttribute) == kAXDialogSubrole && (attr($0, kAXModalAttribute) as? NSNumber)?.boolValue != false)
            || ["open-panel", "save-panel"].contains(text($0, kAXIdentifierAttribute)) }
    }
    func unique(_ nodes: [AXUIElement], _ predicate: (AXUIElement) -> Bool, _ message: String) throws -> AXUIElement {
        let matches = nodes.filter(predicate)
        try check(matches.count == 1, message)
        return matches[0]
    }
    func menu() throws {
        try checkFocus()
        try check(try panels().isEmpty, "Close Logic's other dialogs before exporting.")
        guard let bar = attr(root, kAXMenuBarAttribute) else { throw Failure.message("No Logic menu bar.") }
        var node = unsafeBitCast(bar, to: AXUIElement.self)
        for title in ["File", "Export", "Tracks as Audio Files…"] {
            let parent = node
            node = try wait("Logic menu \(title)") {
                let matches = try walk(parent).filter { label($0) == title || (title == "Tracks as Audio Files…" && ["Track as Audio File…", "1 Track as Audio File…"].contains(label($0))) }
                try check(matches.count <= 1, "Ambiguous Logic export menu.")
                return matches.first
            }
            try check((attr(node, kAXEnabledAttribute) as? NSNumber)?.boolValue != false, "Logic's track export is unavailable.")
            try press(node)
        }
    }
    func panel() throws -> AXUIElement {
        try unique(try walk(root), { text($0, kAXIdentifierAttribute) == "open-panel" }, "Logic track export dialog is missing or ambiguous.")
    }
    func popup(_ choices: [String], _ target: String) throws {
        func selected(_ e: AXUIElement) -> String { let s = text(e, kAXValueAttribute); return s.isEmpty ? label(e) : s }
        let control = try unique(try walk(panel()), { text($0, kAXRoleAttribute) == kAXPopUpButtonRole && choices.contains(selected($0)) }, "Unsupported Logic option: \(target)")
        if selected(control) != target {
            try press(control)
            let option = try wait("Logic option menu") { () -> AXUIElement? in
                let matches = try walk(root).filter { text($0, kAXRoleAttribute) == kAXMenuItemRole && label($0) == target }
                return matches.count == 1 ? matches[0] : nil
            }
            try press(option)
            _ = try wait("Logic option value") { selected(control) == target ? true : nil }
        }
    }
    func checkbox(_ name: String, _ on: Bool) throws {
        let control = try unique(try walk(panel()), { text($0, kAXRoleAttribute) == kAXCheckBoxRole && label($0) == name }, "Unsupported Logic option: \(name)")
        if (attr(control, kAXValueAttribute) as? NSNumber)?.boolValue != on { try press(control) }
        try check((attr(control, kAXValueAttribute) as? NSNumber)?.boolValue == on, "Logic did not confirm \(name).")
    }
    func key(_ code: CGKeyCode, _ flags: CGEventFlags = []) throws {
        try checkFocus()
        func send(_ key: CGKeyCode, _ down: Bool, _ flags: CGEventFlags) throws {
            try checkFocus()
            guard let event = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: down) else { throw Failure.message("Could not operate Logic file dialog.") }
            if key == 55 || key == 56 { event.type = .flagsChanged }
            event.flags = flags; event.post(tap: .cghidEventTap)
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        if code == 5 {
            defer {
                // Always release our modifiers, even when focus changes.
                for key: CGKeyCode in [56, 55] {
                    let event = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: false)
                    event?.type = .flagsChanged; event?.flags = []; event?.post(tap: .cghidEventTap)
                }
            }
            try send(55, true, .maskCommand); try send(56, true, flags)
            try send(code, true, flags); try send(code, false, flags)
        } else {
            try send(code, true, flags); try send(code, false, flags)
        }
    }
    func destination(_ directory: URL) throws {
        _ = try panel()
        try key(5, [.maskCommand, .maskShift]) // Go to Folder, only inside verified export dialog.
        let field = try wait("Logic export folder") { () -> AXUIElement? in
            try walk(root).first { text($0, kAXIdentifierAttribute) == "PathTextField" }
        }
        try value(field, directory.path as CFString)
        try key(36)
        _ = try wait("Logic export destination") { () -> Bool? in
            let nodes = try walk(root)
            if nodes.contains(where: { text($0, kAXIdentifierAttribute) == "PathTextField" }) { return nil }
            let whereControl = nodes.first { text($0, kAXIdentifierAttribute) == "where popup" }
            return whereControl.map { text($0, kAXValueAttribute) == directory.lastPathComponent } == true ? true : nil
        }
    }
    func export(_ request: [String: Any], folder: URL) throws -> [String: Any] {
        let before = try inspect()
        guard let options = request["options"] as? [String: Any], let revision = options["revision"] as? String,
              let ids = options["trackIds"] as? [String], let tracks = before["tracks"] as? [[String: Any]] else { throw Failure.message("Invalid Logic export request.") }
        try check(request["sessionId"] as? String == digest(document) && revision == before["revision"] as? String,
                  "Logic project or track list changed. Refresh before exporting.")
        try check(options["range"] as? String == "entire" && !ids.isEmpty && ids.count <= 64 && Set(ids).count == ids.count,
                  "Choose 1–64 tracks and Entire session.")
        let indices = try ids.map { id -> Int in
            guard let i = tracks.firstIndex(where: { $0["id"] as? String == id }) else { throw Failure.message("Selected Logic track no longer exists.") }
            return i
        }
        let start = try unique(try walk(window), { label($0) == "Start Marker" }, "Logic project start is unavailable.")
        try check((attr(start, kAXValueAttribute) as? NSNumber)?.doubleValue == 0,
                  "Logic projects with a moved start marker are not supported yet. Nothing was exported.")
        try foreground()
        try check(try panels().isEmpty, "Close Logic's other dialogs first.")
        let original = try selectedIndices()
        try JSONSerialization.data(withJSONObject: ["selected": original, "snapshot": before]).write(to: folder.appendingPathComponent("logic-before.json"), options: .atomic)
        var outputs: [[String: Any]] = []
        var failure: Error?
        do {
            for (order, i) in indices.enumerated() {
                try current(revision); try select([i])
                try menu()
                _ = try wait("Logic export dialog") { try? panel() }
                try popup(["Trim Silence at File End", "Export Cycle Range Only", "Extend File Length to Project End"], "Extend File Length to Project End")
                try popup(["WAVE", "AIFF", "CAF"], "WAVE")
                try popup(["16-bit", "24-bit", "32-bit (float)", "32-bit Float"], "24-bit")
                try popup(["Off", "Overload Protection Only", "On"], "Off")
                try checkbox("Bypass Effect Plug-ins", false)
                try checkbox("Include Audio Tail", false)
                try checkbox("Include Volume/Pan Automation", true)
                try checkbox("Add resulting files to Project Browser", false)
                try checkbox("Include Tempo Information", true)
                let out = folder.appendingPathComponent("track-\(order)-\(UUID().uuidString)")
                try FileManager.default.createDirectory(at: out, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
                try destination(out)
                try check(try selectedIndices() == [i], "Logic track selection changed before export.")
                let button = try unique(try walk(panel()), { text($0, kAXIdentifierAttribute) == "OKButton" && label($0) == "Export" }, "No confirmed Logic export button.")
                try press(button)
                var lastSize: UInt64 = 0, stableSince = Date()
                let wav: URL = try wait("Logic offline track export", seconds: 1200) {
                    let dialogs = try panels()
                    for dialog in dialogs where text(dialog, kAXIdentifierAttribute) != "open-panel" {
                        try check(try walk(dialog).contains { text($0, kAXRoleAttribute) == kAXProgressIndicatorRole },
                                  "Logic needs attention in another dialog. Offline export stopped; nothing was attached.")
                    }
                    let files = try FileManager.default.contentsOfDirectory(at: out, includingPropertiesForKeys: nil).filter { $0.pathExtension.lowercased() == "wav" }
                    try check(files.count <= 1, "Logic exported more than one file for a selected track. Nothing will be attached.")
                    guard let file = files.first, let size = (try FileManager.default.attributesOfItem(atPath: file.path)[.size] as? NSNumber)?.uint64Value else { return nil }
                    try check(size <= 298 * 1024 * 1024, "Logic export exceeds the transfer size limit.")
                    if size != lastSize { lastSize = size; stableSince = Date(); return nil }
                    guard size > 44 && Date().timeIntervalSince(stableSince) > 1 else { return nil }
                    let nodes = try walk(root)
                    guard !nodes.contains(where: { text($0, kAXRoleAttribute) == kAXProgressIndicatorRole }), try panels().isEmpty,
                          (try? inspect()) != nil else { return nil }
                    return file
                }
                try current(revision)
                outputs.append(["id": ids[order], "name": tracks[i]["name"]!, "path": out.lastPathComponent + "/" + wav.lastPathComponent])
                try JSONSerialization.data(withJSONObject: ["completed": outputs]).write(to: folder.appendingPathComponent("logic-progress.json"), options: .atomic)
            }
        } catch { failure = error }
        // Never dismiss unknown dialogs or move focus back after a user interruption.
        // Keep the shared lock if we cannot prove restoration completed.
        do {
            try current(revision)
            if let ownPanel = try? panel() {
                let cancel = try unique(try walk(ownPanel), { text($0, kAXIdentifierAttribute) == "CancelButton" }, "No Logic cancel control.")
                try press(cancel)
            }
            try check(try panels().isEmpty, "Logic still has an active export dialog.")
            try select(original)
        } catch {
            return ["ok": false, "cleanupUncertain": true,
                    "error": "Logic export stopped and selection restoration could not be confirmed. Check Logic and the local journal before retrying. \(failure?.localizedDescription ?? error.localizedDescription)"]
        }
        if let failure = failure { throw failure }
        return ["ok": true, "restored": true, "sessionId": digest(document), "revision": revision, "files": outputs]
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
do {
    try check(CommandLine.arguments.count == 2, "Expected a private job directory.")
    let folder = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL.resolvingSymlinksInPath()
    let root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Slur/TrackExport/Jobs").resolvingSymlinksInPath()
    try check(folder.deletingLastPathComponent() == root, "Invalid job directory.")
    let data = try Data(contentsOf: folder.appendingPathComponent("logic-request.json"))
    try check(data.count < 32768, "Oversized Logic request.")
    let request = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    var response: [String: Any]
    do {
        try check((request["expiresAt"] as? Double ?? 0) > Date().timeIntervalSince1970 * 1000, "Expired Logic request.")
        let logic = try Logic()
        if request["operation"] as? String == "inspect" { response = ["ok": true, "snapshot": try logic.inspect()] }
        else if request["operation"] as? String == "export" { response = try logic.export(request, folder: folder) }
        else { throw Failure.message("Unknown Logic operation.") }
    } catch { response = ["ok": false, "error": error.localizedDescription] }
    try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys]).write(to: folder.appendingPathComponent("logic-response.json"), options: .atomic)
} catch { fputs(error.localizedDescription + "\n", stderr); exit(1) }
