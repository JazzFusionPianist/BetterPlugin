// wkshot <file|url> <w> <h> <out.png> [js-file] — load a page in the system WebKit (what Logic uses), run a JS body
// (with `return`) and print its result, then snapshot to PNG. The window is on screen but all but invisible: off-screen
// WebKit gets no animation frames, so transitions never finish and the snapshot lies.
import Cocoa
import WebKit

let args = CommandLine.arguments
guard args.count >= 5 else { print("usage: wkshot <file|url> <w> <h> <out.png> [js-file]"); exit(2) }
let target = args[1], w = CGFloat(Double(args[2])!), h = CGFloat(Double(args[3])!), out = args[4]
let js = args.count > 5 ? (try? String(contentsOfFile: args[5], encoding: .utf8)) ?? "" : ""

class Nav: NSObject, WKNavigationDelegate {
  var done: (() -> Void)?
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { done?() }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { print("FAIL \(error.localizedDescription)"); exit(1) }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { print("FAIL \(error.localizedDescription)"); exit(1) }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: w, height: h), styleMask: [.borderless], backing: .buffered, defer: false)
win.alphaValue = 0.02
win.ignoresMouseEvents = true
win.level = .floating
let conf = WKWebViewConfiguration()
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: w, height: h), configuration: conf)
win.contentView = web
win.orderFrontRegardless()
let nav = Nav()
web.navigationDelegate = nav
nav.done = {
  DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
    let wrapped = "(() => { try { document.getAnimations().forEach(a => { try { a.finish() } catch (e) {} }) } catch (e) {} \(js.isEmpty ? "return ''" : js) })()"
    web.evaluateJavaScript(wrapped) { result, error in
      if let error = error { print("JSERR \(error.localizedDescription)") } else if let s = result as? String { print(s) } else if let r = result { print("\(r)") }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
        let cfg = WKSnapshotConfiguration()
        web.takeSnapshot(with: cfg) { image, err in
          if let image = image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: URL(fileURLWithPath: out))
          } else { print("NOSNAP \(err?.localizedDescription ?? "")") }
          exit(0)
        }
      }
    }
  }
}
if target.hasPrefix("http") { web.load(URLRequest(url: URL(string: target)!)) }
else { let u = URL(fileURLWithPath: target); web.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent()) }
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { print("TIMEOUT"); exit(3) }
app.run()
