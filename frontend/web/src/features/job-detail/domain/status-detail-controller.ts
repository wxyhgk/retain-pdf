// StatusDetailDialog 的组合逻辑(蓝图 §1 判决表的落地点)。本文件收敛为装配根：
// 各职责拆到 dialog/ 下的 controller-*.ts 模块，这里只注入依赖、按序装配、
// 汇总对外方法。对外导出名与 import 路径保持不变。
//
// 与旧世界 features/status-detail/controller.js 的关系(关键偏离,写进汇报):
// controller.js 的公开返回值只有 { activateDetailTab, bindEvents,
// openStatusDetailDialog, buildDetailPageUrl, ensureTranslationData,
// syncRerunAction, ensureOverviewData } —— applyFilter/changePage/loadItem/
// replay/rerunCurrentJob 全部是内部闭包,只能通过 bindEvents() 接的
// event-commands.js 触达(document 委托点击,DOM 事件驱动设计)。JSX 组件需要
// 直接调用这些动作(受控 select/input、按钮 onClick),这个"回调只认 DOM
// 事件"的窄公开面在 React 世界不可行。
//
// 因此本文件不 import controller.js/translation-tab-port.js/
// event-commands.js/navigation-view-port.js/dialog-view-port.js/
// resume-view-port.js/translation-renderer.js/view.js(蓝图判死清单 + 均属
// architecture-boundaries 防回弹禁区),改为直接组合蓝图判"保留"的纯逻辑层:
// overview-coordinator.js / resume-actions.js / translation-data-port.js /
// translation-tab-coordinator.js / translation-state.js / status-detail/
// snapshot.js —— 用自己的 viewPort/render* 回调把它们的输出写进
// status-detail-store.js,而不是拼 DOM markup。逐个方法在 pages 层重新
// 暴露,JSX 直接调用。

import {
  resolveJobActions,
} from "@retainpdf/domain/job";
import {
  createStatusDetailResumeActions,
} from "./dialog/controller-resume.js";
import {
  createStatusDetailOverviewActions,
} from "./dialog/controller-overview.js";
import {
  createStatusDetailFailureRecoveryActions,
} from "./dialog/controller-failure.js";
import {
  createStatusDetailOcrRecoveryActions,
} from "./dialog/controller-ocr-recovery.js";
import {
  createStatusDetailTranslationActions,
} from "./dialog/controller-translation.js";
import {
  createStatusDetailDialogActions,
} from "./dialog/controller-dialog.js";
import type {
  StatusDetailControllerDeps,
} from "./dialog/controller-types.js";

export type {
  JobActionResolver,
  StatusDetailResumeViewPort,
  StatusDetailOverviewRenderContext,
  StatusDetailControllerDeps,
} from "./dialog/controller-types.js";

export function createStatusDetailController({
  runtimePort,
  apiPrefix,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  fetchJobStageActions,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  resolveOcrAmbiguity,
  rerunJob,
  retryJobStage,
  copyText,
  renderJob,
  startPolling,
  setText,
  store,
  dialogStore,
  jobActionResolver = resolveJobActions,
}: StatusDetailControllerDeps) {
  const getCurrentJobId = () => runtimePort.currentJobId();

  const resume = createStatusDetailResumeActions({
    runtimePort,
    store,
    dialogStore,
    rerunJob,
    setText,
    startPolling,
    resolveActions: jobActionResolver,
  });

  const overview = createStatusDetailOverviewActions({
    runtimePort,
    apiPrefix,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobDiagnostics,
    fetchResumePlan,
    fetchJobStageActions,
    renderJob,
    store,
    setText,
    syncRerunAction: resume.syncRerunAction,
  });

  const failureRecovery = createStatusDetailFailureRecoveryActions({
    retryJobStage,
    apiPrefix,
    copyText,
    store,
    dialogStore,
    startPolling,
    setText,
    getCurrentJobId,
  });

  const ocrRecovery = createStatusDetailOcrRecoveryActions({
    runtimePort,
    apiPrefix,
    resolveOcrAmbiguity,
    startPolling,
    store,
    dialogStore,
    setText,
    refreshOverview: () => overview.ensureOverviewData({ force: true }),
  });

  const translation = createStatusDetailTranslationActions({
    runtimePort,
    apiPrefix,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
    store,
  });

  const dialog = createStatusDetailDialogActions({
    dialogStore,
    ensureOverviewData: overview.ensureOverviewData,
    ensureTranslationData: translation.ensureTranslationData,
  });

  return {
    activateDetailTab: dialog.activateDetailTab,
    openStatusDetailDialog: dialog.openStatusDetailDialog,
    buildDetailPageUrl: dialog.buildDetailPageUrl,
    ensureOverviewData: overview.ensureOverviewData,
    ensureTranslationData: translation.ensureTranslationData,
    applyTranslationFilter: translation.applyTranslationFilter,
    changeTranslationPage: translation.changeTranslationPage,
    selectTranslationItem: translation.selectTranslationItem,
    replayCurrentItem: translation.replayCurrentItem,
    rerunCurrentJob: resume.rerunCurrentJob,
    acceptOcrDuplicateRiskAndRecover: ocrRecovery.acceptOcrDuplicateRiskAndRecover,
    bindExistingOcrReceiptAndRecover: ocrRecovery.bindExistingOcrReceiptAndRecover,
    retryOcrNow: failureRecovery.retryOcrNow,
    retryFailureStage: failureRecovery.retryFailureStage,
    copyFailureTraceId: failureRecovery.copyFailureTraceId,
    syncRerunAction: resume.syncRerunAction,
  };
}

export type StatusDetailController = ReturnType<typeof createStatusDetailController>;
