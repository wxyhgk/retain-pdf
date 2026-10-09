// StatusCard 共享模型类型：store 快照 → display / lottie / progress 的投影形状。

import type { useHomeReader } from "@/ui/context/home-services-context.js";
import type { StatusCardIds } from "../status-card-ids-context.js";
import type { StatusCardFallbackItem } from "../../domain/merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
  StatusCardStageProgress,
  StatusCardStageRetryAction,
} from "../../domain/status-card-store.js";
import type { ProgressRenderModelInput } from "../../domain/progress-model.js";

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
  reader: ReturnType<typeof useHomeReader>;
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
  cancelError: string;
  cancelCurrentJob: (() => unknown) | undefined;
  cancel: StatusCardCancelDescription;
  selectedRetry: StatusCardSelectedRetry | null;
  openDetail: () => void;
  visualStageKey: string;
};
