import {
  currentJobFinishedAt,
} from "./runtime/current-job-state.js";
import {
  createStore,
} from "@/platform/store/store.js";
import {
  buildJobStatusSummaryViewModel,
  buildRuntimeStatusCardSnapshot,
} from "@retainpdf/domain/job-status";
import type {
  Store,
} from "@/platform/store/store.js";

// 状态卡 store + presenter(蓝图 §2 features/status/,§4 生命周期)。
//
// 唯一 VM 源:@retainpdf/domain/job-status 的
// buildRuntimeStatusCardSnapshot——直接镜像 components/status/
// connected-job-status-card.js 的 createRuntimeStatusCardSource 语义:无论
// renderMain(主轮询命中)还是 renderPatch(events/manifest/stageActions 三路
// 二级补丁中的任意一路),统一从 currentJobStore + secondaryResourceStore 两个
// canonical store **重新整体计算**一份快照写回 statusCardStore(蓝图风险 10:
// "renderPatch 收敛"——不按 source 分支做局部补丁,规避三份局部更新逻辑各自
// 漂移的风险)。
//
// 风险 6(首帧 placeholder):jobRuntimeFeature.startPolling() 的同步链里
// renderJob() 会在 await 网络请求之前先落一次 placeholder 快照
// (render-context.js 的 applyJobRuntimeSnapshot 同步写 currentJobStore),
// renderMain 在此刻被同步调用,本 store 因此在 React 首次渲染前就已有数据,
// 不会闪空卡。
//
// elapsed 故意不进本 store(蓝图 §3.5):resolveLiveDurations 每秒都变,若随
// 主快照一起写 store,statusCardStore 的 useStoreSnapshot 会被拖着每秒重渲
// 整卡;真正的秒表由 useElapsedTicker.js 独立驱动(读 snapshot.job 的
// started_at/finished_at,不读本 store 的任何"已计算好的" elapsed 字段)。

/** 阶段重试按钮（normalizeStageRetryActions 输出） */
export type StatusCardStageRetryAction = {
  stage: string;
  label: string;
  canRetry: boolean;
  disabledReason: string;
  danger: boolean;
};

/** 阶段进度分片（stageProgressByKey / selectedProgress） */
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

/** job 原始载荷（API 形状宽，状态卡只读子集 + 透传） */
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
 * statusCardStore.snapshot 的完整形状。
 * 字段来自 EMPTY 默认值 + buildJobStatusViewModel + summary 合并。
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
  /** EMPTY 默认携带；运行时以 StatusCardState.cancelDisabled 为准 */
  cancelDisabled?: boolean;
  backgroundStages: unknown[];
  job: StatusCardJobRecord | null;
  summary: StatusCardSummary | null;
  /** runtime VM 可能附带的阶段呈现（merge 时透传） */
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
  getSnapshot: () => import("@retainpdf/domain/job-status").SecondaryResourceSnapshot;
};

export type StatusCardPresenterDeps = {
  state: Record<string, unknown>;
  currentJobStore: CurrentJobStoreLike;
  secondaryResourceStore: SecondaryResourceStoreLike;
  statusCardStore: StatusCardStore;
};

// 拷贝自 components/status/job-status-card-snapshot.js 的零参默认值(该文件
// 属"死,由 StatusCard.jsx 家族替代"清单,不可 import——js/components/ 是
// 防回弹门禁的显式禁区)。只用于 currentJob 尚不存在时的占位快照。
const EMPTY_STATUS_CARD_SNAPSHOT: StatusCardSnapshot = Object.freeze({
  jobId: "",
  status: "",
  label: "等待中",
  value: "准备中",
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
        const next = Boolean(disabled);
        return state.cancelDisabled === next
          ? state
          : { ...state, cancelDisabled: next };
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
    // runtime-source 接受 string | () => string；函数形式走 finishedAtFallbackForStatusCardRuntime
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
    // renderJob(renderContext) / renderJobSecondaryPatch({context,source}) 两个回调
    // 签名不同,但都只需要"重算一次"——参数本身不使用,数据永远从两个 canonical
    // store 读(controller.js 在调用这两个回调之前已经同步写完 store)。
    renderMain: recompute,
    renderPatch: recompute,
    recompute,
  };
}

export { EMPTY_STATUS_CARD_SNAPSHOT };
