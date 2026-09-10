// StatusCard 共享模型：store → snapshot → display / lottie / progress。
// Main 与 Embedded 只消费本 hook 的返回值，不各自再拼一遍。

import { useMemo } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { useStageSelection } from "./useStageSelection.js";
import { useElapsedTicker } from "./useElapsedTicker.js";
import { useStagedProgressAnimation } from "./useStagedProgressAnimation.js";
import { useLottieStageAnimation } from "./useLottieStageAnimation.js";
import { STATUS_CARD_IDS } from "./status-card-dom-ids.js";
import { createPrefixedStatusCardIds, type StatusCardIds } from "./status-card-ids-context.js";
import { mergeSnapshotWithFallback, type StatusCardFallbackItem } from "../domain/merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
  StatusCardStageProgress,
  StatusCardStageRetryAction,
  StatusCardState,
  StatusCardStore,
} from "../domain/status-card-store.js";
import type { ProgressRenderModelInput } from "../domain/progress-model.js";
import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";
import {
  isTerminalStatus,
} from "@retainpdf/domain/job";
import {
  buildSelectedStageDisplay,
  statusStageLabel,
} from "@retainpdf/domain/job-status";

export type StatusCardPrimaryActions = {
  pdfReady: boolean;
  pdfUrl: string;
  markdownBundleReady: boolean;
  markdownBundleUrl: string;
  readerReady: boolean;
  readerUrl: string;
  sourcePdfReady: boolean;
  sourcePdfUrl: string;
};

export type StatusCardErrorState = {
  errorText: string;
  isErrorStage: boolean;
  showError: boolean;
  bodyHasError: boolean;
};

export type StatusCardStageDisplay = {
  flowStageKey: string;
  selected: string;
  selectedHistoricalProgress: StatusCardStageProgress | null;
  selectedIsCurrent: boolean;
  selectedProgress: StatusCardStageProgress;
  visualStageKey: string;
  detailText: string;
  showDetail: boolean;
  errorState: StatusCardErrorState;
  primaryActions: StatusCardPrimaryActions;
  retryAction: StatusCardStageRetryAction | undefined;
};

export type StatusCardElapsed = {
  hasSnapshot: boolean;
  stageElapsedText: string;
  totalElapsedText: string;
};

export type StatusCardLottie = {
  containerRef: { current: HTMLDivElement | null };
  hasStageAnimation: boolean;
  isTranslationStage: boolean;
  isFallback: boolean;
  visualStageKey?: string;
};

export type StatusCardSelection = {
  selectedStageKey: string;
  currentStageKey: string;
  selectStage: (stageKey: string) => void;
  manualStageSelection?: boolean;
};

export type UseStatusCardModelOptions = {
  embedded?: boolean;
  idPrefix?: string;
  fallbackItem?: StatusCardFallbackItem | null;
};

export type StatusCardCancelDescription = {
  cancellable: boolean;
  disabled: boolean;
  busy: boolean;
  title: string;
  label: string;
};

export type StatusCardSelectedRetry = {
  label: string;
  dispatchStage: string;
  title: string;
};

export type HasCancellableStatusCardJobOptions = {
  excludeDocPrefix?: boolean;
};

export type StatusCardModel = {
  services: ReturnType<typeof useHomeServices>;
  ids: StatusCardIds;
  snapshot: StatusCardSnapshot;
  display: StatusCardStageDisplay;
  selection: StatusCardSelection;
  elapsed: StatusCardElapsed;
  lottie: StatusCardLottie;
  renderOptions: ProgressRenderModelInput | null;
  ringLabel: string;
  flowStageKey: string;
  stageKeyForFlow: string;
  selectedForFlow: string;
  cancelDisabled: boolean;
  cancelCurrentJob: (() => unknown) | undefined;
  cancel: StatusCardCancelDescription;
  selectedRetry: StatusCardSelectedRetry | null;
  openDetail: () => void;
  visualStageKey: string;
};

// 两卡共用的可取消判定：有任务 + 状态非空 + 非终态。
// 白名单会漏掉 processing 等后端状态词，这里用非终态判断。
export function hasCancellableStatusCardJob(
  jobId: unknown,
  status: unknown,
  options: HasCancellableStatusCardJobOptions = {},
): boolean {
  const trimmedJobId = `${jobId ?? ""}`.trim();
  if (!trimmedJobId) return false;
  if (options.excludeDocPrefix && trimmedJobId.startsWith("doc:")) return false;
  const normalizedStatus = `${status ?? ""}`.trim().toLowerCase();
  if (normalizedStatus === "" || normalizedStatus === "cancelled") return false;
  return !isTerminalStatus(normalizedStatus);
}

export function describeStatusCardCancel(
  jobId: unknown,
  status: unknown,
  cancelDisabled: unknown,
  options: HasCancellableStatusCardJobOptions = {},
): StatusCardCancelDescription {
  const cancellable = hasCancellableStatusCardJob(jobId, status, options);
  const busy = Boolean(cancelDisabled);
  return {
    cancellable,
    disabled: !cancellable || busy,
    busy,
    title: busy ? "正在取消任务" : "停止并取消当前任务",
    label: busy ? "取消中" : "取消任务",
  };
}

export const STATUS_CARD_STAGE_RETRY_META = {
  ocr: {
    label: "重新 OCR",
    dispatchStage: "ocr",
    actionKeys: ["ocr"] as const,
  },
  translate: {
    label: "重新翻译",
    dispatchStage: "translation",
    actionKeys: ["translate", "translation"] as const,
  },
  render: {
    label: "重新渲染",
    dispatchStage: "render",
    actionKeys: ["render"] as const,
  },
} as const;

export type StatusCardRetryFlowKey = keyof typeof STATUS_CARD_STAGE_RETRY_META;

export function normalizeStatusCardFlowKey(key = ""): string {
  const value = `${key || ""}`.trim().toLowerCase();
  if (value === "translation" || value === "translate" || value === "translating") {
    return "translate";
  }
  if (value === "ocr" || value === "ocr_processing") return "ocr";
  if (value === "render" || value === "rendering") return "render";
  if (value === "done" || value === "finished") return "done";
  return value;
}

function resolveStatusCardStageAction(
  actions: Record<string, StatusCardStageRetryAction> | null | undefined,
  keys: readonly string[],
): StatusCardStageRetryAction | null {
  if (!actions || typeof actions !== "object") return null;
  for (const key of keys) {
    const hit = actions[key];
    if (hit) return hit;
  }
  return null;
}

/**
 * 仅针对「当前选中阶段」返回一颗重试按钮配置。
 * - OCR：有 job 即可（不看失败）
 * - 翻译/渲染：can_retry 或 失败/成功
 * - 完成：不显示
 */
export function resolveStatusCardSelectedRetry(options: {
  hasJob: boolean;
  failed: boolean;
  succeeded: boolean;
  selectedFlow: string;
  stageActions: Record<string, StatusCardStageRetryAction>;
}): StatusCardSelectedRetry | null {
  const { hasJob, failed, succeeded, selectedFlow, stageActions } = options;
  if (!hasJob) return null;
  if (selectedFlow !== "ocr" && selectedFlow !== "translate" && selectedFlow !== "render") {
    return null;
  }
  const flowKey = selectedFlow as StatusCardRetryFlowKey;
  const meta = STATUS_CARD_STAGE_RETRY_META[flowKey];
  const action = resolveStatusCardStageAction(stageActions, meta.actionKeys);

  if (flowKey === "ocr") {
    return {
      label: action?.label || meta.label,
      dispatchStage: meta.dispatchStage,
      title: "从 OCR 重新执行",
    };
  }
  const enabled = Boolean(action?.canRetry) || failed || succeeded;
  if (!enabled) return null;
  return {
    label: action?.label || meta.label,
    dispatchStage: meta.dispatchStage,
    title: action?.disabledReason || meta.label,
  };
}

export function dispatchStatusCardRetryStage(stage: string, jobId = "") {
  if (globalThis.document?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
    globalThis.document.dispatchEvent(
      new globalThis.CustomEvent(APP_EVENTS.retryStage, {
        bubbles: true,
        composed: true,
        detail: {
          stage,
          jobId: `${jobId || ""}`.trim() || undefined,
        },
      }),
    );
  }
}

function resolveVisualStageKeyForSnapshot(
  snapshot: StatusCardSnapshot | null = null,
  selectedStageKey = "",
): string {
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  const visualStageKey = `${snapshot?.visualStageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  if (!selected || selected === stageKey) {
    return visualStageKey || stageKey;
  }
  return selected;
}

export function useStatusCardModel({
  embedded = false,
  idPrefix = "book-detail-",
  fallbackItem = null,
}: UseStatusCardModelOptions = {}): StatusCardModel {
  const services = useHomeServices();
  const { store, cancelCurrentJob } = services.statusCard as {
    store: StatusCardStore;
    cancelCurrentJob?: () => unknown;
  };
  const stateSnapshot = useStoreSnapshot(store) as StatusCardState;
  const rawSnapshot = stateSnapshot.snapshot;
  const snapshot = (embedded
    ? mergeSnapshotWithFallback(rawSnapshot, fallbackItem)
    : rawSnapshot) as StatusCardSnapshot;
  const cancelDisabled = stateSnapshot.cancelDisabled;

  const ids = useMemo(
    () => (embedded ? createPrefixedStatusCardIds(idPrefix) : STATUS_CARD_IDS),
    [embedded, idPrefix],
  );

  const flowStageKey = `${snapshot.status || ""}`.trim() === "succeeded"
    ? "done"
    : `${snapshot.stageKey || ""}`.trim();

  const selection = useStageSelection({
    jobId: snapshot.jobId,
    currentStageKey: flowStageKey || snapshot.stageKey,
  }) as StatusCardSelection;

  const displaySnapshot = useMemo(() => (
    flowStageKey === "done" && snapshot.stageKey !== "done"
      ? { ...snapshot, stageKey: "done" }
      : snapshot
  ), [snapshot, flowStageKey]);

  const display = useMemo(
    () => buildSelectedStageDisplay({
      snapshot: displaySnapshot,
      selectedStageKey: selection.selectedStageKey,
    }) as StatusCardStageDisplay,
    [displaySnapshot, selection.selectedStageKey],
  );

  const elapsed = useElapsedTicker(snapshot.job, { finishedAtFallback: "" }) as StatusCardElapsed;

  const visualStageKey = display.visualStageKey
    || resolveVisualStageKeyForSnapshot(snapshot, display.selected)
    || (flowStageKey === "done" ? "done" : "");

  const lottie = useLottieStageAnimation(visualStageKey, {
    stageKey: display.selected || flowStageKey,
    current: display.selectedProgress?.current,
    total: display.selectedProgress?.total,
    progressUnit: display.selectedProgress?.progressUnit,
  }) as StatusCardLottie;

  const renderOptions = useStagedProgressAnimation({
    selected: display.selected || flowStageKey,
    selectedIsCurrent: display.selectedIsCurrent,
    snapshot: displaySnapshot,
    selectedProgress: display.selectedProgress,
    jobId: snapshot.jobId,
  }) as ProgressRenderModelInput | null;

  const ringLabel = display.selectedIsCurrent
    ? statusStageLabel(selection.currentStageKey || flowStageKey, snapshot.label)
    : statusStageLabel(selection.selectedStageKey, "阶段");

  const stageKeyForFlow = flowStageKey || snapshot.stageKey;
  const selectedForFlow = display.selected || stageKeyForFlow;

  const cancel = describeStatusCardCancel(snapshot?.jobId, snapshot?.status, cancelDisabled, {
    excludeDocPrefix: embedded,
  });

  const selectedRetry = (() => {
    const trimmedJobId = `${snapshot?.jobId || ""}`.trim();
    const hasJob = Boolean(trimmedJobId) && !trimmedJobId.startsWith("doc:");
    const normalizedStatus = `${snapshot?.status || ""}`.trim().toLowerCase();
    return resolveStatusCardSelectedRetry({
      hasJob,
      failed: normalizedStatus === "failed",
      succeeded: normalizedStatus === "succeeded",
      selectedFlow: normalizeStatusCardFlowKey(selectedForFlow || stageKeyForFlow),
      stageActions: snapshot?.stageRetryActions || {},
    });
  })();

  const openDetail = () => {
    services.statusDetail.controller.openStatusDetailDialog("overview");
  };

  return {
    services,
    ids,
    snapshot,
    display,
    selection,
    elapsed,
    lottie,
    renderOptions,
    ringLabel,
    flowStageKey,
    stageKeyForFlow,
    selectedForFlow,
    cancelDisabled,
    cancelCurrentJob,
    cancel,
    selectedRetry,
    openDetail,
    visualStageKey,
  };
}
