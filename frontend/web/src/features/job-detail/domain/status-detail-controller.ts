// StatusDetailDialog 的组合逻辑(蓝图 §1 判决表的落地点)。
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

import type { StatusDetailRuntimePort } from "./status-detail-runtime-port.js";
import type { StatusDetailStore, StatusDetailTranslation } from "./status-detail-store.js";
import type { StatusDetailDialogStore } from "./status-detail-dialog-store.js";
import {
  defaultStatusDetailConfigPort,
} from "./dialog/config-port.js";
import {
  buildFailureRecoveryModel,
  createFailureRecoveryController,
} from "./dialog/failure-recovery.js";
import {
  createStatusDetailOverviewCoordinator,
} from "./dialog/overview-coordinator.js";
import {
  rerunCurrentJob as rerunCurrentJobAction,
  syncRerunAction as syncRerunActionState,
} from "./dialog/resume-actions.js";
import {
  createStatusDetailTranslationDataPort,
} from "./dialog/translation-data-port.js";
import {
  createTranslationState,
} from "./dialog/translation-state.js";
import {
  createStatusDetailTranslationTabCoordinator,
} from "./dialog/translation-tab-coordinator.js";
import {
  buildStatusDetailSnapshot,
} from "./snapshot/snapshot.js";
import {
  resolveJobActions,
} from "@retainpdf/domain/job";
import type {
} from "@/features/ingest/domain.js";
import type {
  JobLike,
  JobPayload,
} from "@retainpdf/domain/job";
import type {
  EventsPayload,
} from "@retainpdf/domain/job-status";
import type {
  OcrAmbiguityResolutionKind,
  OcrAmbiguityResolutionRequest,
} from "@/platform/api/index.js";
import {
  resolveOcrAmbiguityRecovery,
  readOcrAmbiguityView,
  requiresOcrAmbiguityResolution,
} from "./ocr-ambiguity-recovery.js";
import type { OcrReceiptValues } from "./ocr-ambiguity-recovery.js";

export type JobActionResolver = typeof resolveJobActions;

export interface StatusDetailResumeViewPort {
  closeDialog: () => void;
  setRerunAction: (options?: { enabled?: boolean; status?: string }) => void;
  setRerunDisabled: (disabled: boolean) => void;
}

export interface StatusDetailOverviewRenderContext {
  job?: JobLike | JobPayload | null;
  events?: EventsPayload | null;
  jobId?: string;
  [key: string]: unknown;
}

export interface StatusDetailControllerDeps {
  runtimePort: StatusDetailRuntimePort;
  apiPrefix?: string;
  fetchJobPayload?: (jobId: string, options?: { apiPrefix?: string } | string) => Promise<unknown>;
  fetchJobEvents?: (
    jobId: string,
    apiPrefix?: string,
    limit?: number,
    offset?: number,
  ) => Promise<unknown>;
  fetchJobDiagnostics?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchResumePlan?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobStageActions?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationDiagnostics: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationItems: (
    jobId: string,
    apiPrefix?: string,
    query?: StatusDetailTranslation["query"] | Record<string, unknown>,
  ) => Promise<unknown>;
  fetchTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  replayTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  resolveOcrAmbiguity: (
    jobId: string,
    apiPrefix: string | undefined,
    request: OcrAmbiguityResolutionRequest,
  ) => Promise<unknown>;
  rerunJob: (actionUrl: string) => Promise<unknown>;
  retryJobStage?: (
    jobId: string,
    apiPrefix: string | undefined,
    stage: string,
    payload?: Record<string, unknown>,
  ) => Promise<unknown>;
  copyText?: (value: string) => Promise<unknown>;
  renderJob?: (context?: StatusDetailOverviewRenderContext | null) => void;
  startPolling?: (jobId: string) => void;
  setText?: (id: string, message: string) => void;
  store: StatusDetailStore;
  dialogStore: StatusDetailDialogStore;
  jobActionResolver?: JobActionResolver;
}

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
  function getCurrentJobId() {
    return runtimePort.currentJobId();
  }

  // ---- resume/rerun(resume-actions.js 保留;resumeViewPort 换 store 驱动,
  //      不再走 view.js 的 dialogComponent() DOM 查询) ----
  const resumeViewPort: StatusDetailResumeViewPort = {
    closeDialog: () => dialogStore.close(),
    setRerunAction: ({ enabled, status }: { enabled?: boolean; status?: string } = {}) => {
      store.actions.setOverview({ rerun: { enabled: Boolean(enabled), status: status || "" } });
    },
    setRerunDisabled: (disabled: boolean) => store.actions.setRerunPending(disabled),
  };

  function syncRerunAction(statusText = "") {
    return syncRerunActionState({
      ...runtimePort.rerunContext(),
      statusText,
      viewPort: resumeViewPort,
      resolveActions: jobActionResolver,
    });
  }

  async function rerunCurrentJob() {
    await rerunCurrentJobAction({
      rerunContext: runtimePort.rerunContext(),
      rerunJob,
      setText,
      startPolling,
      viewPort: resumeViewPort,
      resolveActions: jobActionResolver,
    });
  }

  async function resolveOcrAmbiguityAndRecover(
    resolution: OcrAmbiguityResolutionKind,
    values: OcrReceiptValues = {},
  ) {
    return resolveOcrAmbiguityRecovery({
      job: runtimePort.currentJobSnapshot(),
      descriptor: store.getSnapshot().overview.ocrAmbiguity.descriptor,
      resolution,
      values,
      apiPrefix,
      resolveOcrAmbiguity,
      refreshDiagnostics: () => ensureOverviewData({ force: true }),
      startPolling,
      closeDialog: () => dialogStore.close(),
      setPending: (pending) => store.actions.setOcrAmbiguityPending(pending),
      setStatus: (status) => store.actions.setOverview({
        ocrAmbiguity: {
          ...store.getSnapshot().overview.ocrAmbiguity,
          status,
        },
      }),
      setGlobalError: (message) => setText?.("error-box", message),
    });
  }

  function acceptOcrDuplicateRiskAndRecover() {
    return resolveOcrAmbiguityAndRecover("accept_duplicate_risk");
  }

  function bindExistingOcrReceiptAndRecover(values: OcrReceiptValues) {
    return resolveOcrAmbiguityAndRecover("bind_existing_receipt", values);
  }

  // ---- overview(overview-coordinator.js 保留;renderOverviewSnapshot 落到
  //      store,job/eventsPayload 存原始值——蓝图 §1 判决表:history.js/
  //      events.js 的 markup 拼接部分不用,StageHistoryList/EventsList 从这
  //      两个原始字段用纯函数各自计算结构化数组) ----
  function renderOverviewSnapshot(context: StatusDetailOverviewRenderContext | null | undefined) {
    const job = context?.job || null;
    const eventsPayload = context?.events || null;
    if (!job) {
      return;
    }
    const finishedAtFallback = runtimePort.currentJobFinishedAt();
    const descriptor = readOcrAmbiguityView(job);
    const jobRecord = job as Record<string, unknown>;
    const jobId = `${jobRecord.job_id || context?.jobId || ""}`.trim();
    const previousAmbiguity = store.getSnapshot().overview.ocrAmbiguity;
    const sameResolution = previousAmbiguity.jobId === jobId
      && previousAmbiguity.descriptor?.resolution_revision === descriptor?.resolution_revision;
    const snapshot = buildStatusDetailSnapshot(job, eventsPayload, {
      durationOptions: { finishedAtFallback },
    });
    const jobWithDiagnostics = job as Record<string, unknown>;
    const failureRecovery = buildFailureRecoveryModel({
      job,
      diagnostics: jobWithDiagnostics.diagnostics,
      stageActions: context?.stageActions,
      resumePlan: runtimePort.currentResumePlan(),
      eventsPayload,
    });
    store.actions.setOverview({
      headline: snapshot.headline,
      runtime: snapshot.runtime,
      failure: snapshot.failure,
      rerun: snapshot.rerun,
      ocrAmbiguity: {
        required: requiresOcrAmbiguityResolution(job),
        status: sameResolution ? previousAmbiguity.status : "",
        jobId,
        descriptor,
      },
      failureRecovery,
      job: job as Record<string, unknown>,
      eventsPayload: eventsPayload as { items?: unknown[]; [key: string]: unknown } | null,
      finishedAtFallback,
    });
    syncRerunAction();
  }

  const overviewTab = createStatusDetailOverviewCoordinator({
    runtimePort,
    apiPrefix,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobDiagnostics,
    fetchResumePlan,
    fetchJobStageActions,
    renderJob,
    renderOverviewSnapshot,
    setErrorText: (message: string) => setText?.("error-box", message),
  });

  async function ensureOverviewData({ force = false }: { force?: boolean } = {}) {
    await overviewTab.ensureLoaded({ force });
  }

  const failureRecoveryActions = createFailureRecoveryController({
    retryStage: retryJobStage
      ? (jobId, stage, payload) => retryJobStage(jobId, apiPrefix, stage, payload)
      : undefined,
    copyTrace: copyText,
  });

  async function retryOcrNow(options: { acceptDuplicateRisk?: boolean } = {}) {
    const jobId = getCurrentJobId();
    const model = store.getSnapshot().overview.failureRecovery;
    const payload = await failureRecoveryActions.retryOcrNow(jobId, model, options) as Record<string, unknown>;
    const nextJobId = `${payload?.job_id || payload?.id || ""}`.trim();
    if (!nextJobId) throw new Error("OCR 重试已提交，但响应中没有 job_id。");
    dialogStore.close();
    setText?.("error-box", `已创建 OCR 恢复任务 ${nextJobId}，开始轮询。`);
    startPolling?.(nextJobId);
    return payload;
  }

  async function copyFailureTraceId() {
    return failureRecoveryActions.copyTraceId(store.getSnapshot().overview.failureRecovery);
  }

  // ---- translation(translation-data-port.js + translation-tab-coordinator.js
  //      保留;render* 回调改成"浅拷贝 translationState 写 store"——store 的
  //      translation 段就是这份状态袋的镜像,加少量纯 UI 态(*Loading/
  //      *ErrorText)) ----
  const translationState = createTranslationState();
  const dataPort = createStatusDetailTranslationDataPort({
    translationState,
    apiPrefix,
    currentJobId: getCurrentJobId,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
  });

  function syncTranslation(extra: Partial<StatusDetailTranslation> = {}) {
    store.actions.setTranslation({ ...translationState, ...extra });
  }

  const translationTab = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message: string) => syncTranslation({
      emptyMessage: message,
      itemsLoading: false,
      itemDetailLoading: false,
    }),
    renderSummary: () => syncTranslation({ emptyMessage: "" }),
    renderItems: (options: { loading?: boolean; emptyText?: string } = {}) => syncTranslation({
      itemsLoading: Boolean(options.loading),
      itemsErrorText: options.loading ? "" : (options.emptyText || ""),
    }),
    renderItemDetail: (options: { loading?: boolean } = {}) => syncTranslation({
      itemDetailLoading: Boolean(options.loading),
    }),
    renderReplay: () => syncTranslation({ replayLoading: false }),
    setReplayLoading: (payload: { hasResult?: boolean } | null) => syncTranslation({
      replayLoading: Boolean(payload && !payload.hasResult),
    }),
  });

  async function ensureTranslationData({ force = false }: { force?: boolean } = {}) {
    await translationTab.ensureLoaded({ force });
  }

  async function applyTranslationFilter(query: { finalStatus?: string; q?: string }) {
    await translationTab.applyFilter(query);
  }

  async function changeTranslationPage(direction: string) {
    await translationTab.changePage(direction);
  }

  async function selectTranslationItem(itemId: string) {
    const normalizedItemId = `${itemId || ""}`.trim();
    if (!normalizedItemId) {
      return;
    }
    try {
      await translationTab.loadItem(getCurrentJobId(), normalizedItemId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncTranslation({ itemErrorText: message, itemDetailLoading: false });
    }
  }

  async function replayCurrentItem() {
    try {
      await translationTab.replaySelected();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncTranslation({ replayErrorText: message, replayLoading: false });
    }
  }

  // ---- 对外统一入口(蓝图 §1:ResultActions.jsx 的 #status-detail-btn 直调
  //      openStatusDetailDialog("overview"),不是事件分发) ----
  function activateDetailTab(name = "overview") {
    dialogStore.open({ activeTab: name });
    if (name === "translation") {
      void ensureTranslationData();
      return;
    }
    void ensureOverviewData();
  }

  function openStatusDetailDialog(tabName = "overview") {
    activateDetailTab(tabName);
  }

  function buildDetailPageUrl(jobId: string) {
    return defaultStatusDetailConfigPort.buildDetailPageUrl(jobId);
  }

  return {
    activateDetailTab,
    openStatusDetailDialog,
    buildDetailPageUrl,
    ensureOverviewData,
    ensureTranslationData,
    applyTranslationFilter,
    changeTranslationPage,
    selectTranslationItem,
    replayCurrentItem,
    rerunCurrentJob,
    acceptOcrDuplicateRiskAndRecover,
    bindExistingOcrReceiptAndRecover,
    retryOcrNow,
    copyFailureTraceId,
    syncRerunAction,
  };
}

export type StatusDetailController = ReturnType<typeof createStatusDetailController>;
