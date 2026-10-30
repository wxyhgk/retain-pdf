import SwiftUI
import UIKit

@main
struct StudioApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Where the app is: no Mac paired yet; looking for the Mac; the Studio open; the Mac not found.
@MainActor
final class Model: ObservableObject {
    enum State {
        case unpaired
        case looking
        case open(URL)
        case failed(String)
    }

    @Published var state: State = .looking
    @Published var mac: PairedMac? = PairedMac.load()
    @Published var pairingError: String?
    @Published var pairing = false

    init() {
        #if DEBUG
        // The simulator has no camera: a pairing code's text given at launch (`-studioPairing '{…}'`), paired with.
        let arguments = ProcessInfo.processInfo.arguments
        if let at = arguments.firstIndex(of: "-studioPairing"), at + 1 < arguments.count, let code = PairingCode.read(arguments[at + 1]) {
            PairedMac.forget()
            mac = nil
            state = .unpaired
            pair(with: code)
            return
        }
        #endif
        if mac == nil { state = .unpaired } else { connect() }
    }

    /// The Mac looked for at its addresses (the Wi-Fi's, Tailscale's), the Studio opened at the first that answers.
    func connect() {
        guard let mac, let key = Keychain.key() else { state = .unpaired; return }
        state = .looking
        Task {
            do {
                state = .open(try await MacLink.reachable(mac, key: key))
            } catch MacError.notPaired {
                forget()
                pairingError = MacError.notPaired.errorDescription
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    func pair(with code: PairingCode) {
        pairing = true
        pairingError = nil
        Task {
            defer { pairing = false }
            do {
                mac = try await MacLink.pair(code, deviceName: UIDevice.current.name)
                connect()
            } catch {
                pairingError = error.localizedDescription
            }
        }
    }

    func forget() {
        PairedMac.forget()
        mac = nil
        state = .unpaired
    }
}

struct ContentView: View {
    @StateObject private var model = Model()
    @State private var scanning = false
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            switch model.state {
            case .unpaired:
                PairView(model: model, scanning: $scanning)
            case .looking:
                VStack(spacing: 14) {
                    ProgressView()
                    Text("正在连接「\(model.mac?.name ?? "Mac")」…").foregroundStyle(.secondary)
                }
            case .open(let address):
                if let mac = model.mac, let key = Keychain.key() {
                    StudioWebView(address: address, mac: mac, key: key, lost: { model.connect() })
                        .ignoresSafeArea(.container, edges: .bottom)
                }
            case .failed(let why):
                VStack(spacing: 16) {
                    Image(systemName: "desktopcomputer.trianglebadge.exclamationmark").font(.system(size: 44)).foregroundStyle(.secondary)
                    Text(why).multilineTextAlignment(.center).frame(maxWidth: 460)
                    HStack(spacing: 12) {
                        Button("重试") { model.connect() }.buttonStyle(.borderedProminent)
                        Button("重新配对") { model.forget() }.buttonStyle(.bordered)
                    }
                }
                .padding(32)
            }
        }
        // Back to the app (from another, from sleep): the Mac looked for again if it was not found.
        .onChange(of: phase) { _, now in
            if now == .active, case .failed = model.state { model.connect() }
        }
    }
}

/// No Mac yet: how to pair one, and the camera to scan its code with.
struct PairView: View {
    @ObservedObject var model: Model
    @Binding var scanning: Bool

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "ipad.and.arrow.forward").font(.system(size: 52)).foregroundStyle(.secondary)
            Text("连接 Mac 上的 Studio").font(.title2.weight(.semibold))
            VStack(alignment: .leading, spacing: 8) {
                Text("1. Mac 上打开 Studio：设置 › 其他设备访问，打开「允许别的设备访问」。")
                Text("2. 点「配对一台设备」，出现一个二维码。")
                Text("3. 在这里扫它。同一个 Wi-Fi，或者 Mac 和 iPad 都开着 Tailscale。")
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: 480, alignment: .leading)
            if model.pairing {
                ProgressView("正在配对…")
            } else if Scanner.available {
                Button("扫码配对") { scanning = true }.buttonStyle(.borderedProminent).controlSize(.large)
            } else {
                Text("这台设备不能扫码（没有相机，或者没给相机权限：设置 › Studio › 相机）。").foregroundStyle(.secondary)
            }
            if let error = model.pairingError {
                Text(error).foregroundStyle(.red).multilineTextAlignment(.center).frame(maxWidth: 480)
            }
        }
        .padding(32)
        .sheet(isPresented: $scanning) {
            ZStack(alignment: .bottom) {
                Scanner { code in
                    scanning = false
                    model.pair(with: code)
                }
                .ignoresSafeArea()
                Button("取消") { scanning = false }.buttonStyle(.borderedProminent).padding(.bottom, 40)
            }
        }
    }
}
