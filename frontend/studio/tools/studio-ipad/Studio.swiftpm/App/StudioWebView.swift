import SwiftUI
import UIKit
import WebKit

/// The Studio's page, from the Mac: in a web view that trusts the Mac's certificate only (by its fingerprint), sends
/// this device's key (a cookie for the address it is opened by), shows the page's alert / confirm / prompt as the
/// system's, opens other sites in Safari, and saves what the page gives to download (导出 Markdown) through the share
/// sheet.
struct StudioWebView: UIViewRepresentable {
    let address: URL
    let mac: PairedMac
    let key: String
    /// The Mac stopped answering (gone to sleep, off the Wi-Fi): the app looks for it again.
    let lost: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(fingerprint: mac.fingerprint, lost: lost)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // As a desktop's: the Studio is laid out for a wide window, and an iPad's is one.
        configuration.defaultWebpagePreferences.preferredContentMode = .desktop
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = false
        view.isInspectable = true
        view.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.view = view
        let cookie = HTTPCookie(properties: [
            .domain: address.host() ?? "",
            .path: "/",
            .name: "studio_device",
            .value: key,
            .secure: "TRUE",
            .expires: Date(timeIntervalSinceNow: 10 * 365 * 24 * 3600),
        ])
        let page = address.appendingPathComponent("studio")
        if let cookie {
            view.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { view.load(URLRequest(url: page)) }
        } else {
            view.load(URLRequest(url: page))
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        let fingerprint: String
        let lost: () -> Void
        weak var view: WKWebView?
        private var downloads: [ObjectIdentifier: URL] = [:]

        init(fingerprint: String, lost: @escaping () -> Void) {
            self.fingerprint = fingerprint
            self.lost = lost
        }

        // The Mac's certificate, by its fingerprint; nothing else.
        func webView(_ webView: WKWebView, respondTo challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
            guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = challenge.protectionSpace.serverTrust else { return (.performDefaultHandling, nil) }
            return Pinning.accepts(trust, fingerprint: fingerprint) ? (.useCredential, URLCredential(trust: trust)) : (.cancelAuthenticationChallenge, nil)
        }

        // The Studio's own pages here; another site's in Safari.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = action.request.url else { return .cancel }
            if action.shouldPerformDownload { return .download }
            if ["http", "https"].contains(url.scheme ?? ""), url.host() != webView.url?.host() ?? url.host(), action.targetFrame?.isMainFrame ?? true {
                await UIApplication.shared.open(url)
                return .cancel
            }
            return .allow
        }

        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
            let attachment = ((response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? "").lowercased().hasPrefix("attachment")
            return attachment || !response.canShowMIMEType ? .download : .allow
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(suggestedFilename)
            downloads[ObjectIdentifier(download)] = file
            return file
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let file = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
            present(UIActivityViewController(activityItems: [file], applicationActivities: nil))
        }

        // The Mac went away while the page was loading: looked for again.
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { lost() }
        }

        // `window.open` / `target="_blank"`: another site in Safari; the Studio's own (a window of its own on the Mac) here.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                if url.host() == webView.url?.host() { webView.load(action.request) } else { UIApplication.shared.open(url) }
            }
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
            await withCheckedContinuation { done in
                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "好", style: .default) { _ in done.resume() })
                present(alert)
            }
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
            await withCheckedContinuation { done in
                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in done.resume(returning: false) })
                alert.addAction(UIAlertAction(title: "好", style: .default) { _ in done.resume(returning: true) })
                present(alert)
            }
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo) async -> String? {
            await withCheckedContinuation { done in
                let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
                alert.addTextField { field in field.text = defaultText }
                alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in done.resume(returning: nil) })
                alert.addAction(UIAlertAction(title: "好", style: .default) { _ in done.resume(returning: alert.textFields?.first?.text ?? "") })
                present(alert)
            }
        }

        private func present(_ controller: UIViewController) {
            guard let view, var top = view.window?.rootViewController else { return }
            while let shown = top.presentedViewController { top = shown }
            if let popover = controller.popoverPresentationController {
                popover.sourceView = view
                popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            }
            top.present(controller, animated: true)
        }
    }
}
