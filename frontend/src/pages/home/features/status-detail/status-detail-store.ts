import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Store đọc của StatusDetailDialog (bản thiết kế §1, danh sách "store mới").
//
// Hai phần song song (quy tắc bất biến về nguồn dữ liệu, bản thiết kế §1.0 + §0):
// - phần overview: headline/runtime/failure/rerun/job/eventsPayload — job/
//   eventsPayload là dữ liệu thô (không phải markup ghép sẵn); StageHistoryList/
//   EventsList dùng hàm thuần tính mảng có cấu trúc trực tiếp từ hai trường này
//   (xem file component tương ứng).
// - phần translation: bản sao nông túi trạng thái createTranslationState() +
//   một ít trạng thái UI (itemsLoading/itemDetailLoading/replayLoading/
//   emptyMessage/errorText), đồng bộ sau mỗi lần đọc/ghi của
//   translation-data-port.js(kept).
//
// Store này và statusCardStore của features/status/status-card-store.js là hai
// đường đọc song song, không hợp nhất — status-detail tự fetch
// (events/diagnostics/resumePlan), tần suất ghi thấp hơn nhiều so với polling 1 giây
// của status card; hợp nhất sẽ làm nhiễu snapshot đăng ký tần suất cao của
// StatusCard (quy tắc bất biến nêu rõ trong bản thiết kế §1.0).

export type StatusDetailHeadline = {
  iconMarkup: string;
  jobId: string;
  note: string;
};

export type StatusDetailRuntime = {
  currentStage: string;
  stageElapsed: string;
  totalElapsed: string;
  retryCount: string;
  lastTransition: string;
  terminalReason: string;
  inputProtocol: string;
  stageSpecVersion: string;
  mathMode: string;
};

export type StatusDetailFailure = {
  summary: string;
  category: string;
  stage: string;
  rootCause: string;
  suggestion: string;
  lastLogLine: string;
  retryable: string;
};

export type StatusDetailRerun = {
  enabled: boolean;
  status: string;
};

/** Payload job thô (StageHistoryList và nơi khác dùng trực tiếp; hình dạng API rộng) */
export type StatusDetailJobPayload = Record<string, unknown>;

/** Payload events thô (EventsList dùng trực tiếp) */
export type StatusDetailEventsPayload = {
  items?: unknown[];
  [key: string]: unknown;
};

/** Đoạn overview: buildStatusDetailSnapshot + tải trọng thô job/events */
export type StatusDetailOverview = {
  headline: StatusDetailHeadline;
  runtime: StatusDetailRuntime;
  failure: StatusDetailFailure;
  rerun: StatusDetailRerun;
  job: StatusDetailJobPayload | null;
  eventsPayload: StatusDetailEventsPayload | null;
  finishedAtFallback: string;
};

export type StatusDetailTranslationQuery = {
  finalStatus: string;
  q: string;
  limit: number;
  offset: number;
};

/**
 * Summary chẩn đoán dịch (túi summary lồng + trường mở rộng tầng trên).
 * TranslationSummary đọc summary.summary.{status_summary,counts,provider_*}.
 */
export type StatusDetailTranslationSummaryInner = {
  status_summary?: Record<string, unknown>;
  final_status_counts?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  provider_family?: string;
  provider?: string;
  [key: string]: unknown;
};

export type StatusDetailTranslationSummary = {
  summary?: StatusDetailTranslationSummaryInner | null;
  [key: string]: unknown;
} | null;

/** Dòng danh sách item (TranslationItemsPanel) */
export type StatusDetailTranslationListItem = {
  item_id?: string;
  block_type?: string;
  classification_label?: string;
  source_preview?: string;
  source_text?: string;
  [key: string]: unknown;
};

/** Chi tiết item được chọn (TranslationItemDetailPanel) */
export type StatusDetailTranslationSelectedItem = {
  item_id?: string;
  item?: StatusDetailTranslationListItem | null;
  page_number?: number | string;
  [key: string]: unknown;
} | null;

/** Túi kết quả phát lại */
export type StatusDetailTranslationReplay = {
  payload?: {
    policy_before?: unknown;
    policy_after?: unknown;
    replay_result?: unknown;
    replay_error?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
} | null;

/** Đoạn translation: ánh createTranslationState + UI loading/error */
export type StatusDetailTranslation = {
  jobId: string;
  loaded: boolean;
  summary: StatusDetailTranslationSummary;
  query: StatusDetailTranslationQuery;
  list: StatusDetailTranslationListItem[];
  total: number;
  selectedItemId: string;
  selectedItem: StatusDetailTranslationSelectedItem;
  replay: StatusDetailTranslationReplay;
  itemsLoading: boolean;
  itemDetailLoading: boolean;
  replayLoading: boolean;
  emptyMessage: string;
  itemsErrorText: string;
  itemErrorText: string;
  replayErrorText: string;
};

export type StatusDetailState = {
  overview: StatusDetailOverview;
  translation: StatusDetailTranslation;
  rerunPending: boolean;
};

export type StatusDetailActions = {
  setOverview: (
    state: StatusDetailState,
    overview?: Partial<StatusDetailOverview>,
  ) => StatusDetailState;
  resetOverview: (state: StatusDetailState) => StatusDetailState;
  setTranslation: (
    state: StatusDetailState,
    translation?: Partial<StatusDetailTranslation>,
  ) => StatusDetailState;
  resetTranslation: (state: StatusDetailState) => StatusDetailState;
  setRerunPending: (state: StatusDetailState, pending?: boolean) => StatusDetailState;
};

export type StatusDetailStore = Store<StatusDetailState, StatusDetailActions>;

const EMPTY_OVERVIEW: StatusDetailOverview = Object.freeze({
  headline: { iconMarkup: "", jobId: "-", note: "" },
  runtime: {
    currentStage: "-",
    stageElapsed: "-",
    totalElapsed: "-",
    retryCount: "0",
    lastTransition: "-",
    terminalReason: "-",
    inputProtocol: "-",
    stageSpecVersion: "-",
    mathMode: "-",
  },
  failure: {
    summary: "-",
    category: "-",
    stage: "-",
    rootCause: "-",
    suggestion: "-",
    lastLogLine: "-",
    retryable: "-",
  },
  rerun: { enabled: false, status: "" },
  job: null,
  eventsPayload: null,
  finishedAtFallback: "",
});

const EMPTY_TRANSLATION: StatusDetailTranslation = Object.freeze({
  jobId: "",
  loaded: false,
  summary: null,
  query: { finalStatus: "", q: "", limit: 20, offset: 0 },
  list: [],
  total: 0,
  selectedItemId: "",
  selectedItem: null,
  replay: null,
  itemsLoading: false,
  itemDetailLoading: false,
  replayLoading: false,
  emptyMessage: "",
  itemsErrorText: "",
  itemErrorText: "",
  replayErrorText: "",
});

export function createStatusDetailStore(): StatusDetailStore {
  return createStore<StatusDetailState, StatusDetailActions>({
    name: "statusDetail",
    initialState: {
      overview: EMPTY_OVERVIEW,
      translation: EMPTY_TRANSLATION,
      rerunPending: false,
    },
    actions: {
      setOverview(state, overview = {}) {
        return { ...state, overview: { ...state.overview, ...overview } };
      },
      resetOverview(state) {
        return { ...state, overview: EMPTY_OVERVIEW };
      },
      setTranslation(state, translation = {}) {
        return { ...state, translation: { ...state.translation, ...translation } };
      },
      resetTranslation(state) {
        return { ...state, translation: EMPTY_TRANSLATION };
      },
      setRerunPending(state, pending = false) {
        return { ...state, rerunPending: Boolean(pending) };
      },
    },
  });
}

export { EMPTY_OVERVIEW, EMPTY_TRANSLATION };
