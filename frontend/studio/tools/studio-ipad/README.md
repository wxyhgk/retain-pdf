# Studio 的 iPad App

在 iPad（或 iPhone）上用你 Mac 上的 Studio：文章、AI（Claude Code、pi）、终端、计算都还在 Mac 上跑，App 只是用它。Mac 要开着，Studio 开着，并且打开了「设置 › iPad 访问」（见 `docs/studio.md`「iPad 访问」）。

App 很小：一个网页视图打开 Mac 上的 Studio，加上扫码配对。它只认配对二维码里那张证书的指纹，所以同一个 Wi-Fi 里也没人能看到或改掉传的东西；配对时 Mac 给它一把钥匙，存在 iPad 的钥匙串里。

## 装到 iPad 上

需要 Xcode（16 以上）和一个 Apple ID（免费的就行）。

1. 用 Xcode 打开 `tools/studio-ipad/Studio.swiftpm`（双击它，或 Xcode › Open）。
2. 左边点最上面的 **Studio**，在 **Signing & Capabilities** 里，**Team** 选你的 Apple ID（没有就 Add Account…）。如果提示 Bundle Identifier 不可用，把 `blog.studio.ipad` 改成独一无二的，比如在后面加上你的名字。
3. 用线把 iPad 连到 Mac，iPad 上点「信任」。第一次还要在 iPad 的 **设置 › 隐私与安全性 › 开发者模式** 里打开开发者模式（会重启）。
4. Xcode 顶上选你的 iPad，点 ▶︎ 运行。第一次 iPad 可能说「不受信任的开发者」：**设置 › 通用 › VPN 与设备管理**，信任你的 Apple ID。
5. 打开 App，点「扫码配对」，扫 Mac 上 Studio「设置 › iPad 访问 › 配对一台 iPad」出现的二维码。它会问能不能用相机、能不能访问本地网络，都要允许。

用免费 Apple ID 装的 App 7 天后会打不开，再用 Xcode 运行一次就好；付费开发者账号是一年。

## 连不上时

- iPad 和 Mac 在同一个 Wi-Fi 吗？不在的话，两边都打开 Tailscale（登录同一个账号）。
- Mac 上 Studio 开着、「iPad 访问」打开着吗？
- 在 Mac 上被「移除」了，App 会让你重新扫码。
- 换了 Wi-Fi、Mac 的地址变了：重新配对一次（新的二维码里是新地址）。

## 开发

- 代码在 `Studio.swiftpm/App/`：`Mac.swift`（配对、证书指纹、找 Mac 的地址）、`StudioWebView.swift`（网页视图：认证书、带上钥匙、弹窗、下载）、`Scanner.swift`（扫码）、`StudioApp.swift`（几个画面）。
- 在模拟器里试（没有相机）：Debug 版启动时可以直接给配对码的文字，`xcrun simctl launch <模拟器> blog.studio.ipad -studioPairing '<二维码里的 JSON>'`。
- 只编译不签名：`xcodebuild -scheme Studio -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`（在 `Studio.swiftpm` 里）。
