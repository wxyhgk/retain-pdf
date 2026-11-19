// jobs —— 任务运行与状态：提交后的轮询、当前任务状态机、主页状态卡、
// 阶段流与进度动画、取消与重试。
//
// 这是本功能对外的唯一出口。
// ui/     状态卡及其阶段流/进度/重试子组件与动画 hook
// domain/ 状态卡展示 store 与进度模型、runtime/ 轮询与当前任务状态机
// 调度归属：任务轮询归 domain/runtime/（失败指数退避 1s→15s 封顶，不可见暂停；
// 成功清错；总表见 platform/contracts/app-contract.ts）。
//
// 展示模型的真值在 @retainpdf/domain 的 job / job-status 两个入口，
// 本功能直接消费，不经主页装配层转发。

export {
  mergeSnapshotWithFallback,
} from "./domain/merge-snapshot-with-fallback.js";
export {
  buildProgressRenderModel,
} from "./domain/progress-model.js";
export {
  isPollingBootstrapPlaceholder,
} from "./domain/polling-placeholder.js";
export {
  resolveTranslationOwnerId,
  type TranslationSourceView,
} from "./domain/translation-owner.js";
export {
  readActiveJobId,
} from "./domain/runtime/active-job-storage.js";
export {
  mountJobRuntimeFeature,
} from "./domain/runtime/controller.js";
export {
  createCurrentJobStatePort,
  currentJobFinishedAt,
  currentJobId,
  currentJobSnapshot,
  currentJobStoreFor,
  syncCurrentJobSnapshot,
} from "./domain/runtime/current-job-state.js";
export {
  JOB_EVENTS_PAGE_SIZE,
  JOB_EVENTS_PREVIEW_PAGE_SIZE,
  createJobEventsResource,
  fetchRecentJobEvents,
  mergeJobEventsPayload,
} from "./domain/runtime/job-events-resource.js";
export {
  createJobRenderContextPort,
} from "./domain/runtime/render-context.js";
export {
  returnJobRuntimeToHome,
} from "./domain/runtime/runtime-reset.js";
export {
  cachedManifestFor,
  createSecondaryResourceStatePort,
  secondaryResourceStoreFor,
} from "./domain/runtime/secondary-resource-cache.js";
export {
  createSecondaryResourceSchedulerPort,
  scheduleSecondaryResourceFetches,
} from "./domain/runtime/secondary-resources.js";
export {
  createStatusAreaFeature,
} from "./domain/status-area.js";
export {
  createStatusCardPresenter,
  createStatusCardStore,
} from "./domain/status-card-store.js";
export {
  StatusCard,
} from "./ui/StatusCard.jsx";
// 结果操作行（Markdown / 原始 PDF / 对照阅读 / 译文 PDF）。
// 它原本只挂在主页那张已下线的状态卡上；进度主场收敛到书籍详情后，
// 由 book-detail 的处理卡复用同一套契约 id（document 级委托据此拦截点击）。
export {
  ResultActions,
} from "./ui/ResultActions.jsx";
export {
  useStatusCardModel,
} from "./ui/status-card/use-status-card-model.js";
