// reader —— 阅读器的 RetainPDF 宿主接线。
//
// 阅读器界面本体在 workspace 包 @retainpdf/reader；本功能负责把 RetainPDF 的
// 数据、AI、收藏、下载、凭据与配置注入给它，并提供主页侧的打开入口。
//
// ui/     主页里的阅读器弹窗与软宿主
// domain/ 宿主能力（host/）与打开路由、下载、运行时端口（dialog/）
//
// 非 React 调用方（reader 页自身）请从 ./domain.js 导入，不要走本文件。

export * from "./domain.js";
export { ReaderDialog } from "./ui/ReaderDialog.jsx";
export { SoftReaderHost } from "./ui/SoftReaderHost.jsx";
