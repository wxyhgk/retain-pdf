// Logic tổ hợp của StatusDetailDialog (điểm hạ cánh của bảng phán quyết bản thiết kế §1).
//
// Mối quan hệ với features/status-detail/controller.js của thế giới cũ (độ lệch quan trọng, ghi vào báo cáo):
// Giá trị trả về công khai của controller.js chỉ có { activateDetailTab, bindEvents,
// openStatusDetailDialog, buildDetailPageUrl, ensureTranslationData,
// syncRerunAction, ensureOverviewData } —— applyFilter/changePage/loadItem/
// replay/rerunCurrentJob toàn bộ là closure nội bộ, chỉ có thể tiếp cận qua event-commands.js
// gắn với bindEvents() (ủy quyền nhấp document, thiết kế hướng sự kiện DOM). JSX component cần
// gọi trực tiếp các hành động này (select/input có kiểm soát, nút onClick), bề mặt công khai hẹp
// kiểu "callback chỉ nhận DOM event" này không khả thi trong thế giới React.
//
// Vì vậy tệp này không import controller.js/translation-tab-port.js/
// event-commands.js/navigation-view-port.js/dialog-view-port.js/
// resume-view-port.js/translation-renderer.js/view.js (danh sách bản thiết kế tuyên tử + đều thuộc
// vùng cấm chống hồi quy của architecture-boundaries), mà chuyển sang tổ hợp trực tiếp tầng logic thuần được bản thiết kế giữ lại:
// overview-coordinator.js / resume-actions.js / translation-data-port.js /
// translation-tab-coordinator.js / translation-state.js / status-detail/
// snapshot.js —— dùng callback viewPort/render* của riêng mình để ghi output vào
// status-detail-store.js, thay vì ghép DOM markup. Từng phương thức được phơi bày lại
// ở tầng pages, JSX gọi trực tiếp.

import type { StatusDetailRuntimePort } from "./status-detail-runtime-port.js";
import type { StatusDetailStore, StatusDetailTranslation } from "./status-detail-store.js";
import type { StatusDetailDialogStore } from "./status-detail-dialog-store.js";
import {
  buildStatusDetailSnapshot,
  resolveJobActions,
  createStatusDetailOverviewCoordinator,
  rerunCurrentJob as rerunCurrentJobAction,
  syncRerunAction as syncRerunActionState,
  createStatusDetailTranslationDataPort,
  createStatusDetailTranslationTabCoordinator,
  createTranslationState,
  defaultStatusDetailConfigPort,
} from "../../composition/external.js";
import type {
  JobLike,
  JobPayload,
  EventsPayload,
} from "../../composition/external.js";

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
  fetchJobPayload?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobEvents?: (
    jobId: string,
    apiPrefix?: string,
    limit?: number,
    offset?: number,
  ) => Promise<unknown>;
  fetchJobDiagnostics?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchResumePlan?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationDiagnostics: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationItems: (
    jobId: string,
    apiPrefix?: string,
    query?: StatusDetailTranslation["query"] | Record<string, unknown>,
  ) => Promise<unknown>;
  fetchTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  replayTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  rerunJob: (actionUrl: string) => Promise<unknown>;
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
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  rerunJob,
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

  // ---- resume/rerun (resume-actions.js giữ lại; resumeViewPort đổi sang store điều khiển,
  //      không đi qua DOM query dialogComponent() của view.js nữa) ----
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

  // ---- overview (overview-coordinator.js giữ lại; renderOverviewSnapshot ghi vào
  //      store, job/eventsPayload lưu giá trị gốc —— bảng phán quyết bản thiết kế §1: phần ghép markup
  //      của history.js/events.js không dùng, StageHistoryList/EventsList từ hai trường
  //      gốc này dùng hàm thuần tự tính toán mảng có cấu trúc tương ứng) ----
  function renderOverviewSnapshot(context: StatusDetailOverviewRenderContext | null | undefined) {
    const job = context?.job || null;
    const eventsPayload = context?.events || null;
    if (!job) {
      return;
    }
    const finishedAtFallback = runtimePort.currentJobFinishedAt();
    const snapshot = buildStatusDetailSnapshot(job, eventsPayload, {
      durationOptions: { finishedAtFallback },
    });
    store.actions.setOverview({
      headline: snapshot.headline,
      runtime: snapshot.runtime,
      failure: snapshot.failure,
      rerun: snapshot.rerun,
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
    renderJob,
    renderOverviewSnapshot,
    setErrorText: (message: string) => setText?.("error-box", message),
  });

  async function ensureOverviewData({ force = false }: { force?: boolean } = {}) {
    await overviewTab.ensureLoaded({ force });
  }

  // ---- translation (translation-data-port.js + translation-tab-coordinator.js
  //      giữ lại; callback render* đổi thành "shallow copy translationState ghi vào store" —— đoạn
  //      translation của store chính là bản sao của túi trạng thái này, cộng thêm một số trạng thái UI thuần (*Loading/
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

  // ---- Lối vào thống nhất đối ngoại (bản thiết kế §1: #status-detail-btn của ResultActions.jsx gọi trực tiếp
  //      openStatusDetailDialog("overview"), không qua phân phối sự kiện) ----
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
    syncRerunAction,
  };
}

export type StatusDetailController = ReturnType<typeof createStatusDetailController>;
