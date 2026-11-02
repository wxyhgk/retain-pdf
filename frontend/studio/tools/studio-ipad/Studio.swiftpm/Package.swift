// swift-tools-version: 5.9

// The Studio on an iPad (or an iPhone): the Studio running on the author's Mac, opened through its door for other
// devices (设置 › 其他设备访问), paired by its QR code. Open this folder in Xcode, choose a team (Signing), and run it on
// the iPad. See README.md.

import AppleProductTypes
import PackageDescription

let package = Package(
    name: "Studio",
    platforms: [.iOS("17.0")],
    products: [
        .iOSApplication(
            name: "Studio",
            targets: ["App"],
            bundleIdentifier: "blog.studio.ipad",
            displayVersion: "0.1",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .pencil),
            accentColor: .presetColor(.indigo),
            supportedDeviceFamilies: [.pad, .phone],
            supportedInterfaceOrientations: [.portrait, .portraitUpsideDown, .landscapeLeft, .landscapeRight],
            capabilities: [
                .camera(purposeString: "扫 Mac 上 Studio 显示的配对二维码。"),
                .localNetwork(purposeString: "连接同一个 Wi-Fi 里那台 Mac 上的 Studio。", bonjourServiceTypes: []),
            ]
        ),
    ],
    targets: [
        .executableTarget(name: "App", path: "App"),
    ]
)
