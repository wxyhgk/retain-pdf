// lan-share —— 局域网共享（桌面版）：设置里的开关、地址、二维码、重置访问码。
// 网关在桌面主进程（frontend/desktop/src/main/lan-share.js），这里只是设置面板。
//
// domain/ 状态描述（纯函数）
// ui/     设置面板

export { LanSharePanel } from "./ui/LanSharePanel.jsx";
export { lanShareHeadline } from "./domain/describe.js";

// 设置弹窗里这一栏的登记 / 图标（20261112-功能登记表）。
export { lanShareSettingsSection } from "./ui/settings-section.jsx";
