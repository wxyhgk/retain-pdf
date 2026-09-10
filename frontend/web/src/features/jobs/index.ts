// jobs —— 任务运行与状态：提交后的轮询、当前任务状态机、主页状态卡、
// 阶段流与进度动画、取消与重试。
//
// 这是本功能对外的唯一出口。
// ui/     状态卡及其阶段流/进度/重试子组件与动画 hook
// domain/ 状态卡展示 store 与进度模型、runtime/ 轮询与当前任务状态机
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
