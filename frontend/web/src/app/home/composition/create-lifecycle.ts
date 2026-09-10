// initialize / dispose：A9 壳生命周期唯一收口（事件绑定 + idle 视图 + startup 路由）。
//
// 启动顺序（见 entry.tsx / shell-boot.ts）：
//   1. composition：建 state/view → createBridge（窄回调桥）→ 各域挂 features →
//      workflowDialog.bindEvents（先于 recent-jobs，见 create-home-composition 注释）→
//      createRuntimeFeatures（job-runtime / recent-jobs / artifacts 一次挂齐）→ createLifecycle。
//      特性在 createRuntimeFeatures 已挂好；workflow 对话框事件在 composition
//      里先于 recent-jobs 绑定（见 composition.js 注释）。
//   2. bridge：随 composition 建好（无独立启动步），被 initializeIdleView 经端口消费。
//   3. initialize()：bindDocumentEvents（retryStage / returnHome）→
//      applyStartupRoute（reader/job_id/活动任务 → startPolling 恢复）→
//      initializeIdleView（经 bridge 落 idle store，可重复调）。
//   4. createRoot().render（mountShellPage：bootTheme → 找根 → 挂载，不开 StrictMode）。
//
// 销毁顺序（initialize 的逆序）：
//   disposeWorkflowDialogEvents → disposeDocumentEvents（解绑 retryStage / returnHome）→
//   jobRuntimeFeature.stopPolling()。事件生产者/消费者对照见 js/contracts/app-contract.ts。

import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { requestedReaderJobIdFromLocation } from "@/features/reader/domain.js";
import { normalizeJobPayload, summarizeStatus } from "@retainpdf/domain/job";
import { readActiveJobId } from "@/features/jobs/index.js";
import {
  initializeIdleAppView,
  defaultAppShellConfigPort,
} from "./idle-view.js";
import { parseDetailJobId } from "@/platform/navigation/pages.js";

import type { HomeBridge, HomeFeatures } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasRecordDetail(event: Event): event is CustomEvent<Record<string, unknown>> {
  return "detail" in event && isRecord(event.detail);
}

type CreateLifecycleArgs = {
  features: HomeFeatures;
  bridge: HomeBridge;
  documentRef: Document;
  disposeWorkflowDialogEvents?: (() => void) | null;
};

export function createLifecycle({
  features,
  bridge,
  documentRef,
  disposeWorkflowDialogEvents,
}: CreateLifecycleArgs) {
  let disposeDocumentEvents: (() => void) | null = null;
  let started = false;

  function initializeIdleView() {
    initializeIdleAppView({
      configPort: defaultAppShellConfigPort,
      jobPresentationPort: { normalizeJobPayload, summarizeStatus },
      setText: bridge.setText,
      setWorkflowSections: bridge.setWorkflowSections,
      setLinearProgress: bridge.setLinearProgress,
      updateActionButtons: bridge.updateActionButtons,
      renderPageRangeSummary: bridge.renderPageRangeSummary,
      resetUploadProgress: bridge.resetUploadProgress,
      resetUploadedFile: bridge.resetUploadedFile,
      applyWorkflowMode: bridge.applyWorkflowMode,
      updateJobWarning: bridge.updateJobWarning,
      resetEventsList: bridge.resetEventsList,
      activateDetailTab: bridge.activateDetailTab,
    });
  }

  function bindDocumentEvents() {
    const onRetryStage = (event: Event) => {
      const detail = hasRecordDetail(event) ? event.detail : {};
      const stage = `${detail.stage || ""}`.trim();
      const jobId = `${detail.jobId || detail.job_id || ""}`.trim();
      if (stage) features.jobRuntimeFeature.retryStage(stage, jobId ? { jobId } : {});
    };
    const onReturnHome = () => features.jobRuntimeFeature.returnToHome();
    documentRef.addEventListener(APP_EVENTS.retryStage, onRetryStage);
    documentRef.addEventListener(APP_EVENTS.returnHome, onReturnHome);
    return () => {
      documentRef.removeEventListener(APP_EVENTS.retryStage, onRetryStage);
      documentRef.removeEventListener(APP_EVENTS.returnHome, onReturnHome);
    };
  }

  function applyStartupRoute() {
    const fromReader = requestedReaderJobIdFromLocation();
    const fromQuery = parseDetailJobId();
    const fromActiveSession = readActiveJobId();
    const jobId = fromReader || fromQuery || fromActiveSession;
    if (!jobId) return;
    // 普通首页刷新没有 job_id 查询参数。此时必须从持久化的活动任务恢复
    // currentJobStore，否则后台仍在执行，详情页却会表现成“任务断开”。
    features.jobRuntimeFeature.startPolling(jobId, fromActiveSession && !fromReader && !fromQuery
      ? { silent: true, showWorkflow: false, publishLibrary: false, recovering: true }
      : undefined);
  }

  function initialize() {
    if (!started) {
      disposeDocumentEvents = bindDocumentEvents();
      started = true;
      applyStartupRoute();
    }
    initializeIdleView();
  }

  function dispose() {
    disposeWorkflowDialogEvents?.();
    disposeDocumentEvents?.();
    disposeDocumentEvents = null;
    features.recentJobsFeature?.disposeFeatureEvents?.();
    const disposeArtifactDownloads = (features.artifactDownloadsFeature as { disposeEvents?: unknown } | undefined)?.disposeEvents;
    if (typeof disposeArtifactDownloads === "function") {
      (disposeArtifactDownloads as () => void)();
    }
    features.jobRuntimeFeature.stopPolling();
    started = false;
  }

  return {
    initialize,
    dispose,
    appShellFeature: { initializeIdleView },
  };
}
