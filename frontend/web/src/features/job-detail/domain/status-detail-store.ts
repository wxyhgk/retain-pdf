import {
  createStore,
} from "@/platform/store/store.js";
import type {
  Store,
} from "@/platform/store/store.js";
import type { OcrAmbiguityView } from "@/platform/api/index.js";
import type {
  FailureRecoveryModel,
} from "./dialog/failure-recovery.js";

// StatusDetailDialog 的读面 store(蓝图 §1 "新 store"清单)。
//
// 两个并行段(数据源铁律,蓝图 §1.0 + §0 全局发现):
// - overview 段:headline/runtime/failure/rerun/job/eventsPayload——job/
//   eventsPayload 是原始数据(不是预拼好的 markup),StageHistoryList/
//   EventsList 直接从这两个字段用纯函数计算结构化数组(见对应组件文件)。
// - translation 段:createTranslationState() 状态袋的浅拷贝 + 少量 UI 态
//   (itemsLoading/itemDetailLoading/replayLoading/emptyMessage/errorText),
//   随 translation-data-port.js(kept)每次读写后同步。
//
// 本 store 与 features/status/status-card-store.js 的 statusCardStore 是两条
// 平行读路径,不合并——status-detail 自己 fetch(events/diagnostics/
// resumePlan),写入频率远低于状态卡的 1s 轮询,合并会污染 StatusCard 的高频
// 订阅快照(蓝图 §1.0 明确铁律)。

export type StatusDetailHeadline = {
  iconMarkup: string;
  jobId: string;
  note: string;
  statusLabel: string;
  tone: "neutral" | "running" | "success" | "failed";
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
  logText: string;
  retryable: string;
};

export type StatusDetailRerun = {
  enabled: boolean;
  status: string;
};

export type StatusDetailOcrAmbiguity = {
  required: boolean;
  status: string;
  jobId: string;
  descriptor: OcrAmbiguityView | null;
};

/** 原始 job 载荷（StageHistoryList 等直接消费；API 形状宽） */
export type StatusDetailJobPayload = Record<string, unknown>;

/** 原始 events 载荷（EventsList 直接消费） */
export type StatusDetailEventsPayload = {
  items?: unknown[];
  [key: string]: unknown;
};

/** overview 段：buildStatusDetailSnapshot + job/events 原始载荷 */
export type StatusDetailOverview = {
  headline: StatusDetailHeadline;
  runtime: StatusDetailRuntime;
  failure: StatusDetailFailure;
  rerun: StatusDetailRerun;
  ocrAmbiguity: StatusDetailOcrAmbiguity;
  failureRecovery: FailureRecoveryModel;
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
 * 翻译诊断 summary（嵌套 summary 口袋 + 顶层扩展字段）。
 * TranslationSummary 读 summary.summary.{status_summary,counts,provider_*}。
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

/** Item 列表行（TranslationItemsPanel） */
export type StatusDetailTranslationListItem = {
  item_id?: string;
  block_type?: string;
  classification_label?: string;
  source_preview?: string;
  source_text?: string;
  [key: string]: unknown;
};

/** 选中 item 详情（TranslationItemDetailPanel） */
export type StatusDetailTranslationSelectedItem = {
  item_id?: string;
  item?: StatusDetailTranslationListItem | null;
  page_number?: number | string;
  [key: string]: unknown;
} | null;

/** 重放结果袋 */
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

/** translation 段：createTranslationState 镜像 + UI loading/error */
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
  ocrAmbiguityPending: boolean;
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
  setOcrAmbiguityPending: (
    state: StatusDetailState,
    pending?: boolean,
  ) => StatusDetailState;
};

export type StatusDetailStore = Store<StatusDetailState, StatusDetailActions>;

const EMPTY_OVERVIEW: StatusDetailOverview = Object.freeze({
  headline: {
    iconMarkup: "",
    jobId: "-",
    note: "",
    statusLabel: "准备中",
    tone: "neutral" as const,
  },
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
    logText: "",
    retryable: "-",
  },
  rerun: { enabled: false, status: "" },
  ocrAmbiguity: { required: false, status: "", jobId: "", descriptor: null },
  failureRecovery: {
    kind: "generic" as const,
    provider: "",
    providerCode: "",
    traceId: "",
    attempt: null,
    maxAttempts: null,
    retryAtMs: null,
    retryAfterSource: "",
    retryOcr: {
      available: false,
      enabled: false,
      method: "" as const,
      url: "",
      body: {},
      reason: "",
      requiresDuplicateRisk: false,
    },
    resumeFrom: "",
    recoveryHint: "",
    stages: [],
    checkpointArtifacts: [],
    preservesSourcePdf: false,
    statusText: "",
    preservationText: "",
    backendGaps: [],
  },
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
      ocrAmbiguityPending: false,
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
      setOcrAmbiguityPending(state, pending = false) {
        return { ...state, ocrAmbiguityPending: Boolean(pending) };
      },
    },
  });
}

export { EMPTY_OVERVIEW, EMPTY_TRANSLATION };
