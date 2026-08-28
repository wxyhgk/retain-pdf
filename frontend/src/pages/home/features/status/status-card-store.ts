import {
  createStore,
  buildRuntimeStatusCardSnapshot,
  buildJobStatusSummaryViewModel,
  currentJobFinishedAt,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Store thẻ trạng thái + presenter (bản thiết kế §2 features/status/, §4 vòng đời).
//
// Nguồn VM duy nhất: buildRuntimeStatusCardSnapshot từ job-status/status-card-runtime-source.js
// —— sao chép trực tiếp ngữ nghĩa của createRuntimeStatusCardSource từ components/status/
// connected-job-status-card.js: dù là renderMain (trúng polling chính) hay renderPatch (bất kỳ đường nào trong ba đường
// bản vá cấp hai events/manifest/stageActions), đều thống nhất tính toán lại toàn bộ một bản snapshot từ hai
// canonical store currentJobStore + secondaryResourceStore và ghi lại vào statusCardStore (rủi ro 10 trong bản thiết kế:
// "renderPatch hội tụ" —— không thực hiện bản vá cục bộ theo nguồn, tránh rủi ro ba logic cập nhật cục bộ bị trôi dạt riêng lẻ).
//
// Rủi ro 6 (placeholder khung đầu tiên): trong chuỗi đồng bộ của jobRuntimeFeature.startPolling()
// renderJob() sẽ ghi một bản snapshot placeholder trước khi await yêu cầu mạng
// (applyJobRuntimeSnapshot trong render-context.js ghi đồng bộ vào currentJobStore),
// renderMain được gọi đồng bộ tại thời điểm này, do đó store này đã có dữ liệu trước khi React render lần đầu,
// không để thẻ trống.
//
// elapsed cố tình không đưa vào store này (bản thiết kế §3.5): resolveLiveDurations thay đổi mỗi giây, nếu ghi cùng với
// snapshot chính vào store, useStoreSnapshot của statusCardStore sẽ bị kéo theo render lại toàn bộ thẻ mỗi giây;
// đồng hồ thực sự được điều khiển độc lập bởi useElapsedTicker.js (đọc started_at/finished_at từ snapshot.job,
// không đọc bất kỳ trường "đã tính toán sẵn" elapsed nào từ store này).

/** Nút thử lại giai đoạn (đầu ra của normalizeStageRetryActions) */
export type StatusCardStageRetryAction = {
  stage: string;
  label: string;
  canRetry: boolean;
  disabledReason: string;
  danger: boolean;
};

/** Phân mảnh tiến độ giai đoạn (stageProgressByKey / selectedProgress) */
export type StatusCardStageProgress = {
  current?: number;
  total?: number;
  progressCurrent?: number;
  progressTotal?: number;
  displayPercent?: number | null;
  progressText?: string;
  progressUnit?: string;
  progress_unit?: string;
  indeterminate?: boolean;
  progressIndeterminate?: boolean;
  substageKey?: string;
  visualStageKey?: string;
  bySubstage?: Record<string, StatusCardStageProgress>;
  [key: string]: unknown;
};

/** Payload gốc của job (API có hình dạng rộng, thẻ trạng thái chỉ đọc một tập con + truyền thẳng) */
export type StatusCardJobRecord = {
  job_id?: string;
  status?: string;
  stage?: string;
  stage_detail?: string;
  progress?: {
    percent?: number;
    current?: number;
    total?: number;
    unit?: string;
  };
  progress_percent?: number;
  timestamps?: {
    started_at?: string;
    finished_at?: string;
  };
  started_at?: string;
  finished_at?: string;
  [key: string]: unknown;
};

export type StatusCardSummary = {
  errorText: string;
  fields: {
    jobId: string;
    jobIdInput: string;
    stageDetail: string;
    statusSummary: string;
    finishedAt: string;
    queryFinishedAt: string;
  };
  publicErrorText: string;
};

/**
 * Hình dạng đầy đủ của statusCardStore.snapshot.
 * Trường đến từ EMPTY mặc định + buildJobStatusViewModel + merge summary.
 */
export type StatusCardSnapshot = {
  jobId: string;
  status: string;
  label: string;
  value: string;
  detail: string;
  stageKey: string;
  progressCurrent: number;
  progressTotal: number;
  progressFallbackText: string;
  displayPercent: number | null;
  progressPercent: number;
  progressText: string;
  progressUnit: string;
  progressIndeterminate: boolean;
  substageKey: string;
  errorText: string;
  visualStageKey: string;
  stageProgressByKey: Record<string, StatusCardStageProgress>;
  stageRetryActions: Record<string, StatusCardStageRetryAction>;
  pdfReady: boolean;
  pdfUrl: string;
  markdownBundleReady: boolean;
  markdownBundleUrl: string;
  readerReady: boolean;
  readerUrl: string;
  sourcePdfReady: boolean;
  sourcePdfUrl: string;
  cancelEnabled: boolean;
  /** Mặc định kèm theo từ EMPTY; runtime lấy StatusCardState.cancelDisabled làm chuẩn */
  cancelDisabled?: boolean;
  backgroundStages: unknown[];
  job: StatusCardJobRecord | null;
  summary: StatusCardSummary | null;
  /** Trình bày giai đoạn mà runtime VM có thể đính kèm (truyền thẳng khi merge) */
  stagePresentation?: Record<string, unknown> | null;
  elapsed?: string;
};

export type StatusCardState = {
  snapshot: StatusCardSnapshot;
  cancelDisabled: boolean;
};

export type StatusCardActions = {
  setSnapshot: (state: StatusCardState, snapshot: StatusCardSnapshot) => StatusCardState;
  setCancelDisabled: (state: StatusCardState, disabled?: boolean) => StatusCardState;
};

export type StatusCardStore = Store<StatusCardState, StatusCardActions>;

export type StatusCardPresenter = {
  renderMain: () => void;
  renderPatch: () => void;
  recompute: () => void;
};

type CurrentJobStoreLike = {
  getSnapshot: () => {
    jobId?: string;
    snapshot?: StatusCardJobRecord | null;
  };
};

type SecondaryResourceStoreLike = {
  getSnapshot: () => import("../../../../js/job-status/status-card-runtime-source.js").SecondaryResourceSnapshot;
};

export type StatusCardPresenterDeps = {
  state: Record<string, unknown>;
  currentJobStore: CurrentJobStoreLike;
  secondaryResourceStore: SecondaryResourceStoreLike;
  statusCardStore: StatusCardStore;
};

// Sao chép giá trị mặc định không tham số từ components/status/job-status-card-snapshot.js (tệp đó
// thuộc danh sách "chết, đã thay bằng họ StatusCard.jsx", không được import —— js/components/ là
// khu vực cấm rõ ràng bởi cổng chống hồi quy). Chỉ dùng làm snapshot placeholder khi currentJob chưa tồn tại.
const EMPTY_STATUS_CARD_SNAPSHOT: StatusCardSnapshot = Object.freeze({
  jobId: "",
  status: "",
  label: "Đang chờ",
  value: "Đang chuẩn bị",
  detail: "",
  stageKey: "",
  progressCurrent: NaN,
  progressTotal: NaN,
  progressFallbackText: "-",
  displayPercent: null,
  progressPercent: NaN,
  progressText: "",
  progressUnit: "",
  progressIndeterminate: false,
  substageKey: "",
  errorText: "",
  visualStageKey: "",
  stageProgressByKey: {},
  stageRetryActions: {},
  pdfReady: false,
  pdfUrl: "",
  markdownBundleReady: false,
  markdownBundleUrl: "",
  readerReady: false,
  readerUrl: "",
  sourcePdfReady: false,
  sourcePdfUrl: "",
  cancelEnabled: false,
  cancelDisabled: false,
  backgroundStages: [],
  job: null,
  summary: null,
});

export function createStatusCardStore(): StatusCardStore {
  return createStore<StatusCardState, StatusCardActions>({
    name: "statusCard",
    initialState: {
      snapshot: EMPTY_STATUS_CARD_SNAPSHOT,
      cancelDisabled: false,
    },
    actions: {
      setSnapshot(state, snapshot) {
        return { ...state, snapshot };
      },
      setCancelDisabled(state, disabled = false) {
        return { ...state, cancelDisabled: Boolean(disabled) };
      },
    },
  });
}

export function createStatusCardPresenter({
  state,
  currentJobStore,
  secondaryResourceStore,
  statusCardStore,
}: StatusCardPresenterDeps): StatusCardPresenter {
  function recompute() {
    const currentJob = currentJobStore.getSnapshot();
    const secondaryResources = secondaryResourceStore.getSnapshot();
    // runtime-source chấp nhận string | () => string; hình thức hàm đi qua finishedAtFallbackForStatusCardRuntime
    const rawSnapshot = buildRuntimeStatusCardSnapshot({
      currentJob,
      secondaryResources,
      state,
      finishedAtFallback: () => currentJobFinishedAt(state),
    }) as (Partial<StatusCardSnapshot> & { stagePresentation?: Record<string, unknown> | null }) | null;
    if (!rawSnapshot) {
      statusCardStore.actions.setSnapshot(EMPTY_STATUS_CARD_SNAPSHOT);
      return;
    }
    const summary = buildJobStatusSummaryViewModel(
      currentJob?.snapshot || {},
      rawSnapshot.stagePresentation || {},
    ) as StatusCardSummary;
    statusCardStore.actions.setSnapshot({
      ...EMPTY_STATUS_CARD_SNAPSHOT,
      ...rawSnapshot,
      summary,
    });
  }

  return {
    // renderJob(renderContext) / renderJobSecondaryPatch({context,source}) hai callback
    // chữ ký khác nhau, nhưng đều chỉ cần "tính lại một lần" —— tham số tự thân không dùng,
    // dữ liệu luôn đọc từ hai canonical store (controller.js đã ghi xong store đồng bộ trước khi gọi hai callback này).
    renderMain: recompute,
    renderPatch: recompute,
    recompute,
  };
}

export { EMPTY_STATUS_CARD_SNAPSHOT };
