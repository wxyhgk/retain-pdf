// job-detail —— 任务详情：主页里点状态卡展开的详情弹窗（总览/事件/失败/翻译
// 四个 tab、失败日志、OCR 歧义绑定、断点续跑），以及 detail.html 独立页面
// （产物、事件时间线、错误诊断）。
//
// 这是本功能对外的唯一出口。
// ui/     详情弹窗与各 tab、面板、列表
// domain/ 弹窗 store 与控制器、OCR 歧义恢复、运行时端口
//         dialog/  失败恢复、格式化、翻译数据端口与协调器
//         snapshot/ 详情快照与事件/历史模型
//         page/    detail.html 页面的产物、续跑、路由与摘要
//
// 双实现分区（有意保留，禁止不经重做测试擅自合并）：
//   A. 弹窗实现 —— ui/StatusDetail*.tsx + ui/panels/* + domain/dialog/*，
//      经 createStatusDetailController 驱动，ConfirmDialog 做二次确认。
//   B. 整页实现 —— ui/page/* + domain/page/*，命令式写入 DOM，
//      整页无 React，用同一按钮两步态做二次确认（见 page/resume.ts）。
//   共享真值：domain/snapshot/*（徽标/备注/事件/历史呈现）与
//   @retainpdf/domain（状态/阶段归一化）。新增展示语义先落 snapshot，
//   两端只做薄投影；同概念文案以弹窗侧为准（见命名规则 R1）。
//
// 展示模型真值在 @retainpdf/domain；跨功能依赖走对方的出口，
// 本功能不引用主页装配层。

export {
  createStatusDetailConfigPort,
  defaultStatusDetailConfigPort,
} from "./domain/dialog/config-port.js";
export {
  buildFailureRecoveryModel,
  createFailureRecoveryController,
  queueFullTitle,
  retryCountdownSeconds,
} from "./domain/dialog/failure-recovery.js";
export type {
  FailureRecoveryAction,
  FailureRecoveryKind,
  FailureRecoveryModel,
  FailureRecoveryStage,
} from "./domain/dialog/failure-recovery.js";
export {
  boolLabel,
  degradationReasonOf,
  diagnosticsOf,
  errorTypesOf,
  fallbackToOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  normalizeRoutePath,
  pageNumberOf,
  previewText,
  routePathOf,
  stringifyPretty,
  summarizeTranslationFilter,
} from "./domain/dialog/formatters.js";
export {
  createStatusDetailOverviewCoordinator,
} from "./domain/dialog/overview-coordinator.js";
export {
  rerunCurrentJob,
  syncRerunAction,
} from "./domain/dialog/resume-actions.js";
export {
  createStatusDetailTranslationDataPort,
} from "./domain/dialog/translation-data-port.js";
export {
  createTranslationState,
} from "./domain/dialog/translation-state.js";
export {
  createStatusDetailTranslationTabCoordinator,
} from "./domain/dialog/translation-tab-coordinator.js";
export {
  resetStatusDetailRuntimeView,
} from "./domain/runtime-view-reset.js";
export {
  buildOcrAmbiguityRequest,
  ocrRecoveryJobId,
  readOcrAmbiguityView,
  requiresOcrAmbiguityResolution,
  resolveOcrAmbiguityRecovery,
} from "./domain/ocr-ambiguity-recovery.js";
export {
  isReaderActionEnabled,
  renderJobDetailActionLinks,
} from "./domain/page/action-links.js";
export {
  createJobDetailConfigPort,
  defaultJobDetailConfigPort,
} from "./domain/page/config-port.js";
export {
  createJobDetailDataPort,
  defaultJobDetailDataPort,
} from "./domain/page/data-port.js";
export {
  loadAndRenderMarkdownFlow,
} from "./domain/page/markdown-flow.js";
export {
  renderJobDetailOverview,
} from "./domain/page/overview-renderer.js";
export {
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
} from "./domain/page/page-state.js";
export {
  createJobDetailResumePort,
  defaultJobDetailResumePort,
} from "./domain/page/resume-port.js";
export {
  bindRerunButton,
} from "./domain/page/resume.js";
export {
  getJobIdFromQuery,
} from "./domain/page/routing.js";
export {
  renderJobDetailFailureSummary,
  renderJobDetailRuntimeSummary,
} from "./domain/page/summary.js";
export {
  buildEventsPresentation,
} from "./domain/snapshot/events.js";
export {
  buildStageHistoryPresentation,
} from "./domain/snapshot/history.js";
export {
  buildFailureLogText,
  buildStatusDetailSnapshot,
} from "./domain/snapshot/snapshot.js";
export {
  createStatusDetailController,
} from "./domain/status-detail-controller.js";
export {
  createStatusDetailDialogStore,
} from "./domain/status-detail-dialog-store.js";
export {
  createStatusDetailRuntimePort,
} from "./domain/status-detail-runtime-port.js";
export {
  createStatusDetailStore,
} from "./domain/status-detail-store.js";
export {
  StatusDetailDialog,
} from "./ui/StatusDetailDialog.jsx";

// detail.html 整页的展示组件（C1 从 app/detail/components 迁入）。
// 逐个显式列出，不用 export * —— barrel 无差别转出会连带触发模块级副作用。
export { DetailHeader } from "./ui/page/DetailHeader.js";
export {
  ErrorNoticeCard,
  JobSummaryCard,
  MetaRow,
} from "./ui/page/JobSummaryCard.js";
export { ErrorDiagnostics } from "./ui/page/ErrorDiagnostics.js";
export {
  ArtifactsSection,
  MarkdownCard,
} from "./ui/page/ArtifactsSection.js";
export {
  EventsModal,
  EventsTriggerCard,
  StageHistoryModal,
  StageHistoryTriggerCard,
} from "./ui/page/EventsTimeline.js";
