// app-update —— 应用更新检查与更新提示横幅。
//
// 这是本功能对外的唯一出口：其他功能与页面装配层只能从这里导入，
// 不得深入 ui/ 或 domain/ 内部（架构门禁会拦截）。
//
// ui/     React 横幅与更新详情弹窗、DOM id 契约
// domain/ 视图 store、状态枚举、版本比较、GitHub release 拉取与归一、
//         24h 缓存、检查编排（全部与 React 无关）

export { AppUpdateBanner } from "./ui/AppUpdateBanner.jsx";
export type { AppUpdateBannerProps } from "./ui/AppUpdateBanner.jsx";
export { createAppUpdateViewFeature } from "./domain/app-update-store.js";
export type {
  AppUpdatePanel,
  AppUpdateReadOnlyStore,
  AppUpdateReleaseInfo,
  AppUpdateViewActions,
  AppUpdateViewState,
  AppUpdateViewStore,
  HandlersBag,
} from "./domain/app-update-store.js";
export { APP_UPDATE_IDS } from "./ui/app-update-contract.js";
export { APP_UPDATE_STATES } from "./domain/app-update-states.js";

export { mountAppUpdateFeature } from "./domain/controller.js";
export { APP_VERSION } from "./domain/current-version.js";
export { defaultUpdateCachePort } from "./domain/state.js";
export {
  fetchLatestGithubRelease,
  normalizeReleaseInfo,
} from "./domain/github-release.js";
