// artifacts —— 受保护产物（译文 PDF、Markdown、源文件等）的下载。
//
// 这是本功能对外的唯一出口：其他功能与页面装配层只能从这里导入，
// 不得深入 domain/ 内部（架构门禁会拦截）。
//
// 下载入口是各处状态卡/详情面板上的按钮，由 controller 在 document 上做
// 委托点击并按 id 契约命中；domain/ 另有下载 busy 态 store，ui/ 是它的
// React 订阅 hook（按 actionId 取切片，供 jobs/job-detail 的按钮消费）。

export { createArtifactDownloadBusyStore } from "./domain/busy-store.js";
export type { ArtifactDownloadBusyStore } from "./domain/busy-store.js";
export { mountArtifactDownloadsFeature } from "./domain/controller.js";
export { createArtifactDownloadsRuntimePort } from "./domain/runtime-port.js";
export {
  defaultDownloadNameResolver,
  downloadActionForLink,
  resolveDownloadActionTarget,
  resolveDownloadActionTargetWithResolver,
} from "./domain/download-actions.js";
export { useArtifactDownloadBusy } from "./ui/use-artifact-download-busy.js";
