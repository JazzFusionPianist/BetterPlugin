// Read-only qualification worker. Does not select tracks, render, or upload.
// Images stay in memory; only OCR observations from one allowlisted DAW dialog
// are returned. This is deliberately not a general desktop capture endpoint.
import AppKit
import ScreenCaptureKit
import Vision

enum ProbeFailure: Error, LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let s) = self { return s }; return nil }
}
struct ProbeRequest: Decodable {
    let operation: String
    let host: String
    let expiresAt: Double
}
struct ProbeProfile {
    let bundle: String
    let title: String
    static func resolve(_ host: String) throws -> ProbeProfile {
        switch host {
        case "cubase15": return .init(bundle: "com.steinberg.cubase15", title: "Export Audio Mixdown")
        case "fender8": return .init(bundle: "com.fender.studioapp", title: "Export Stems")
        default: throw ProbeFailure.message("Host is not qualified for this probe.")
        }
    }
}
func requireProbe(_ condition: Bool, _ message: String) throws {
    if !condition { throw ProbeFailure.message(message) }
}
func probeWindow(_ content: SCShareableContent, _ profile: ProbeProfile, _ pid: pid_t) throws -> SCWindow {
    let matches = content.windows.filter {
        $0.owningApplication?.processID == pid && $0.owningApplication?.bundleIdentifier == profile.bundle
            && $0.title == profile.title && $0.isOnScreen
    }
    try requireProbe(matches.count == 1, "Open exactly one \(profile.title) dialog in the selected DAW for qualification.")
    return matches[0]
}

// Initial, deliberately narrow dark-theme Fender profile. These observations
// are not stable track IDs and do not establish coverage below the scroll fold.
func fenderRows(_ image: CGImage, _ lines: [[String: Any]], _ frame: CGRect) -> [[String: Any]] {
    guard abs(frame.width - 1014) < 1, abs(frame.height - 588) < 1,
          lines.contains(where: { $0["text"] as? String == "Sources" }),
          let header = lines.first(where: { $0["text"] as? String == "Channels" && ($0["y"] as? Double ?? 0) > 0.19 }),
          let speakers = lines.first(where: { $0["text"] as? String == "Speakers" }),
          let footer = lines.first(where: { $0["text"] as? String == "Select" }),
          let hx = header["x"] as? Double, let hy = header["y"] as? Double,
          let sx = speakers["x"] as? Double, let fy = footer["y"] as? Double,
          abs(hx - 0.077) < 0.01, abs(sx - 0.225) < 0.01 else { return [] }
    var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let made = bytes.withUnsafeMutableBytes { storage -> Bool in
        guard let context = CGContext(data: storage.baseAddress, width: image.width, height: image.height,
                                      bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return true
    }
    guard made else { return [] }
    let candidates = lines.filter {
        guard let x = $0["x"] as? Double, let y = $0["y"] as? Double,
              let w = $0["width"] as? Double else { return false }
        return x >= hx - 0.012 && x < sx - 0.02 && x + w < sx + 0.005 && y > hy + 0.035 && y < fy - 0.035
    }.sorted { ($0["y"] as! Double) < ($1["y"] as! Double) }
    return candidates.enumerated().map { ordinal, line in
        let cy = ((line["y"] as! Double) + (line["height"] as! Double) / 2) * Double(image.height)
        let cx = 35.0 / frame.width * Double(image.width)
        let radius = 5.0 / frame.width * Double(image.width)
        var bright = 0, dark = 0, total = 0
        for y in Int(cy - radius)...Int(cy + radius) {
            for x in Int(cx - radius)...Int(cx + radius) where x >= 0 && y >= 0 && x < image.width && y < image.height {
                let index = (y * image.width + x) * 4
                let luminance = (Int(bytes[index]) + Int(bytes[index + 1]) + Int(bytes[index + 2])) / 3
                if luminance > 170 { bright += 1 }; if luminance < 90 { dark += 1 }; total += 1
            }
        }
        let whiteRatio = Double(bright) / Double(max(1, total))
        let darkRatio = Double(dark) / Double(max(1, total))
        let mark = darkRatio > 0.65 && whiteRatio > 0.06 ? "checked"
            : darkRatio > 0.98 && whiteRatio == 0 ? "unchecked" : "unknown"
        return ["name": line["text"]!, "visibleOrdinal": ordinal, "confidence": line["confidence"]!,
                "checkboxObservation": mark, "brightFraction": whiteRatio,
                "darkFraction": darkRatio, "y": cy / Double(image.height)]
    }
}

@main struct VisualHostProbe {
    @MainActor static func main() async {
        NSApplication.shared.setActivationPolicy(.accessory)
        do {
            // Checking permission never requests or changes macOS privacy settings.
            if CommandLine.arguments == [CommandLine.arguments[0], "--permission-status"] {
                print(CGPreflightScreenCaptureAccess() ? "screen-capture-granted" : "screen-capture-required")
                return
            }
            try requireProbe(CommandLine.arguments.count == 2, "Expected a private qualification job directory.")
            let fm = FileManager.default
            let folder = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
            let root = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Slur/TrackExport/Jobs").resolvingSymlinksInPath()
            try requireProbe(folder == folder.resolvingSymlinksInPath() && folder.deletingLastPathComponent() == root, "Invalid qualification job directory.")
            let attributes = try fm.attributesOfItem(atPath: folder.path)
            try requireProbe((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o700
                && (attributes[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(), "Qualification job must be private and owned by this user.")
            let input = folder.appendingPathComponent("visual-request.json")
            try requireProbe(input == input.resolvingSymlinksInPath(), "Request cannot be a symbolic link.")
            let size = try fm.attributesOfItem(atPath: input.path)[.size] as? NSNumber
            try requireProbe((size?.intValue ?? Int.max) < 4096, "Oversized qualification request.")
            let request = try JSONDecoder().decode(ProbeRequest.self, from: Data(contentsOf: input))
            let profile = try ProbeProfile.resolve(request.host)
            try requireProbe(request.operation == "inspect-export-dialog", "Unsupported qualification operation.")
            let now = Date().timeIntervalSince1970 * 1000
            try requireProbe(request.expiresAt > now && request.expiresAt <= now + 120000, "Expired or invalid qualification request.")
            let output = folder.appendingPathComponent("visual-response.json")
            try requireProbe(!fm.fileExists(atPath: output.path), "Refusing to overwrite a previous qualification result.")
            var response: [String: Any]
            do {
                try requireProbe(CGPreflightScreenCaptureAccess(), "Screen recording permission is required for Slur Visual Bridge. No image was captured.")
                let apps = NSRunningApplication.runningApplications(withBundleIdentifier: profile.bundle)
                try requireProbe(apps.count == 1, "Open exactly one instance of the selected DAW.")
                let pid = apps[0].processIdentifier
                let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
                let window = try probeWindow(content, profile, pid)
                try requireProbe(window.frame.width >= 500 && window.frame.height >= 300
                    && window.frame.width <= 4000 && window.frame.height <= 3000, "Unexpected export dialog dimensions.")
                let filter = SCContentFilter(desktopIndependentWindow: window)
                let configuration = SCStreamConfiguration()
                configuration.width = Int(window.frame.width * 2)
                configuration.height = Int(window.frame.height * 2)
                configuration.showsCursor = false
                configuration.capturesAudio = false
                configuration.ignoreShadowsSingleWindow = true
                let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
                let recognition = VNRecognizeTextRequest()
                recognition.recognitionLevel = .accurate
                recognition.usesLanguageCorrection = false // Track names must not be spell-corrected.
                recognition.recognitionLanguages = ["en-US", "ko-KR"]
                try VNImageRequestHandler(cgImage: image).perform([recognition])
                let fresh = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
                let same = try probeWindow(fresh, profile, pid)
                try requireProbe(same.windowID == window.windowID && same.frame == window.frame,
                                 "Export window changed while reading it; discard this observation.")
                try requireProbe(request.expiresAt > Date().timeIntervalSince1970 * 1000, "Qualification request expired while reading the window.")
                let lines: [[String: Any]] = (recognition.results ?? []).compactMap { item in
                    guard let text = item.topCandidates(1).first else { return nil }
                    let r = item.boundingBox
                    return ["text": text.string, "confidence": text.confidence,
                            "x": Double(r.minX), "y": Double(1 - r.maxY),
                            "width": Double(r.width), "height": Double(r.height)]
                }
                response = ["ok": true, "host": request.host, "bundleId": profile.bundle,
                            "windowId": window.windowID, "title": profile.title,
                            "width": image.width, "height": image.height, "lines": lines,
                            "completeTrackList": false, "exportReady": false,
                            "note": "Read-only OCR observation; checkbox state, scrolling coverage and rendering are not qualified."]
                if request.host == "fender8" {
                    response["visibleRows"] = fenderRows(image, lines, window.frame)
                }
            } catch {
                response = ["ok": false, "exportReady": false, "error": error.localizedDescription]
            }
            let data = try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
            try data.write(to: output, options: .withoutOverwriting)
            try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.path)
            if response["ok"] as? Bool != true { exit(2) }
        } catch { fputs(error.localizedDescription + "\n", stderr); exit(1) }
    }
}
