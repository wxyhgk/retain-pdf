// initialize / dispose：Gắn kết sự kiện + idle đồ thị hình chiếu + startup Định tuyến。
// Các tính năng trong createRuntimeFeatures Treo cổ；workflow Sự kiện hội thoại tại composition
// Li đi trước recent-jobs trói chặt（thấy composition.js Ghi chú:）。

import {
  APP_EVENTS,
  requestedReaderJobIdFromLocation,
  initializeIdleAppView,
  defaultAppShellConfigPort,
  normalizeJobPayload,
  summarizeStatus,
} from "./external.js";

import type { HomeBridge, HomeFeatures } from "./types.js";

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
      const detail = (event as CustomEvent)?.detail || {};
      const stage = `${detail?.stage || ""}`.trim();
      const jobId = `${detail?.jobId || detail?.job_id || ""}`.trim();
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
    const fromQuery = `${new URLSearchParams(globalThis.location?.search || "").get("job_id") || ""}`.trim();
    const jobId = fromReader || fromQuery;
    if (jobId) features.jobRuntimeFeature.startPolling(jobId);
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
    features.jobRuntimeFeature.stopPolling();
    started = false;
  }

  return {
    initialize,
    dispose,
    appShellFeature: { initializeIdleView },
  };
}
