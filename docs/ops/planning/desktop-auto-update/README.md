# 桌面端自动更新和 Mac 签名（2026-11 起）

Windows、Mac 桌面版自己检查、后台下载新版本，下好提示「重启即可更新」；Mac 安装包用 Developer ID 签名并公证。
文件名用 `YYYYMMDD-主题.md`，新的决定追加新文件，旧文件保留不改写。

| 日期 | 文档 | 内容 |
|---|---|---|
| 2026-11-22 | [自动更新和 Mac 签名](./20261122-自动更新和Mac签名.md) | 签名放在测试之后的单独 job（sign-macos.yml）；Mac 打包的 Python.framework 修正；Release 多传 latest*.yml、.blockmap、Mac zip；App 内 electron-updater；同一天再发版的编号 |
