import CryptoKit
import Foundation
import Security

/// What the QR code on the Mac says (设置 › iPad 访问, remote-access.mjs `pairingCode`): where the Mac can be
/// reached, the port of its door, its certificate's fingerprint, and the code to pair with (5 minutes, once).
struct PairingCode: Decodable {
    let v: Int
    let name: String
    let hosts: [String]
    let port: Int
    let fp: String
    let code: String

    static func read(_ text: String) -> PairingCode? {
        guard let data = text.data(using: .utf8), let code = try? JSONDecoder().decode(PairingCode.self, from: data), code.v == 1, !code.hosts.isEmpty else { return nil }
        return code
    }
}

/// The Mac paired with: kept on this device (where it is, in the settings; its key, in the Keychain).
struct PairedMac: Codable, Equatable {
    var name: String
    var hosts: [String]
    var port: Int
    var fingerprint: String

    private static let saved = "pairedMac"

    static func load() -> PairedMac? {
        guard let data = UserDefaults.standard.data(forKey: saved), let mac = try? JSONDecoder().decode(PairedMac.self, from: data), Keychain.key() != nil else { return nil }
        return mac
    }

    func save(key: String) {
        UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: Self.saved)
        Keychain.setKey(key)
    }

    static func forget() {
        UserDefaults.standard.removeObject(forKey: saved)
        Keychain.setKey(nil)
    }

    func address(_ host: String) -> URL {
        // An IPv6 address in brackets; the rest as they are.
        let shown = host.contains(":") ? "[\(host)]" : host
        return URL(string: "https://\(shown):\(port)")!
    }
}

/// The device's key the Mac gave it when it was paired: the Keychain's, on this device only.
enum Keychain {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "blog.studio.ipad", kSecAttrAccount as String: "device-key"]

    static func key() -> String? {
        var found: AnyObject?
        var asked = query
        asked[kSecReturnData as String] = true
        guard SecItemCopyMatching(asked as CFDictionary, &found) == errSecSuccess, let data = found as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func setKey(_ key: String?) {
        SecItemDelete(query as CFDictionary)
        guard let key else { return }
        var added = query
        added[kSecValueData as String] = Data(key.utf8)
        added[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(added as CFDictionary, nil)
    }
}

/// The Mac's certificate is its own (made by the Studio): trusted only when it is the one the QR code named, by its
/// SHA-256 fingerprint (`AB:CD:…`, as Node writes it). Nothing else is trusted: no one between this device and the Mac
/// can read or change what goes through, on the Wi-Fi either.
enum Pinning {
    static func fingerprint(of trust: SecTrust) -> String? {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], let leaf = chain.first else { return nil }
        let digest = SHA256.hash(data: SecCertificateCopyData(leaf) as Data)
        return digest.map { String(format: "%02X", $0) }.joined(separator: ":")
    }

    /// Whether a server's trust is the Mac's, by the fingerprint wanted.
    static func accepts(_ trust: SecTrust, fingerprint wanted: String) -> Bool {
        fingerprint(of: trust)?.caseInsensitiveCompare(wanted) == .orderedSame
    }
}

/// A URLSession that trusts the Mac's certificate only (by its fingerprint).
final class PinnedSession: NSObject, URLSessionDelegate {
    let fingerprint: String
    lazy var session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)

    init(fingerprint: String) {
        self.fingerprint = fingerprint
    }

    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = challenge.protectionSpace.serverTrust, Pinning.accepts(trust, fingerprint: fingerprint) else {
            return completionHandler(.cancelAuthenticationChallenge, nil)
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}

enum MacError: LocalizedError {
    case unreachable
    case refused(String)
    case notPaired

    var errorDescription: String? {
        switch self {
        case .unreachable: "连不上那台 Mac：它开着吗？Studio 开着、「iPad 访问」打开了吗？在同一个 Wi-Fi 里，或者两边都开着 Tailscale？"
        case .refused(let why): why
        case .notPaired: "这台设备不再是配对过的了（在 Mac 上被移除了？）：重新扫码配对。"
        }
    }
}

enum MacLink {
    /// The first of the Mac's addresses that answers (a few seconds each, all at once): the Wi-Fi's when at home,
    /// Tailscale's when away. `key`: checked too (a device removed on the Mac is told so).
    static func reachable(_ mac: PairedMac, key: String) async throws -> URL {
        let pinned = PinnedSession(fingerprint: mac.fingerprint)
        return try await withThrowingTaskGroup(of: (URL, Int)?.self) { group in
            for host in mac.hosts {
                group.addTask {
                    var asked = URLRequest(url: mac.address(host).appendingPathComponent("studio"), timeoutInterval: 4)
                    asked.httpMethod = "HEAD"
                    asked.setValue("studio_device=\(key)", forHTTPHeaderField: "Cookie")
                    guard let (_, answer) = try? await pinned.session.data(for: asked), let status = (answer as? HTTPURLResponse)?.statusCode else { return nil }
                    return (mac.address(host), status)
                }
            }
            var refused = false
            for try await found in group {
                guard let (url, status) = found else { continue }
                if status == 401 { refused = true; continue }
                group.cancelAll()
                return url
            }
            throw refused ? MacError.notPaired : MacError.unreachable
        }
    }

    /// Paired by the code: the first address that answers is asked, the key it gives kept.
    static func pair(_ code: PairingCode, deviceName: String) async throws -> PairedMac {
        let pinned = PinnedSession(fingerprint: code.fp)
        let mac = PairedMac(name: code.name, hosts: code.hosts, port: code.port, fingerprint: code.fp)
        var lastError: Error = MacError.unreachable
        for host in code.hosts {
            var asked = URLRequest(url: mac.address(host).appendingPathComponent("pair"), timeoutInterval: 6)
            asked.httpMethod = "POST"
            asked.setValue("application/json", forHTTPHeaderField: "Content-Type")
            asked.httpBody = try JSONSerialization.data(withJSONObject: ["code": code.code, "name": deviceName])
            do {
                let (data, answer) = try await pinned.session.data(for: asked)
                let said = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                guard (answer as? HTTPURLResponse)?.statusCode == 200, let key = said?["key"] as? String else {
                    throw MacError.refused(said?["error"] as? String ?? "Mac 没有接受配对。")
                }
                mac.save(key: key)
                return mac
            } catch let error as MacError {
                throw error
            } catch {
                lastError = error
            }
        }
        throw (lastError as? MacError) ?? MacError.unreachable
    }
}
