// Mô hình dùng chung của StatusCard: store → snapshot → display / lottie / progress.
// Main và Embedded chỉ tiêu thụ giá trị trả về của hook này, không ghép lại từng cái.

import { useMemo } from "react";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useStageSelection } from "./useStageSelection.js";
import { useElapsedTicker } from "./useElapsedTicker.js";
import { useStagedProgressAnimation } from "./useStagedProgressAnimation.js";
import { useLottieStageAnimation } from "./useLottieStageAnimation.js";
import { STATUS_CARD_IDS } from "./status-card-dom-ids.js";
import { createPrefixedStatusCardIds, type StatusCardIds } from "./status-card-ids-context.js";
import { mergeSnapshotWithFallback, type StatusCardFallbackItem } from "./merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
  StatusCardStageProgress,
  StatusCardStageRetryAction,
  StatusCardState,
  StatusCardStore,
} from "./status-card-store.js";
import type { ProgressRenderModelInput } from "./progress-model.js";
import {
  statusStageLabel,
  buildSelectedStageDisplay,
} from "../../composition/external.js";

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
  openDetail: () => void;
  visualStageKey: string;
};

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
    : statusStageLabel(selection.selectedStageKey, "Giai đoạn");

  const stageKeyForFlow = flowStageKey || snapshot.stageKey;
  const selectedForFlow = display.selected || stageKeyForFlow;

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
    openDetail,
    visualStageKey,
  };
}
