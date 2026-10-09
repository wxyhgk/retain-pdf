// store → snapshot 派生：读取 statusCardStore、合并 fallback、解析 ids / flow / selection。

import { useMemo } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeStatusCard } from "@/ui/context/home-services-context.js";
import { useStageSelection } from "../useStageSelection.js";
import { STATUS_CARD_IDS } from "../status-card-dom-ids.js";
import { createPrefixedStatusCardIds, type StatusCardIds } from "../status-card-ids-context.js";
import { mergeSnapshotWithFallback } from "../../domain/merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
  StatusCardState,
  StatusCardStore,
} from "../../domain/status-card-store.js";
import type { StatusCardSelection, UseStatusCardModelOptions } from "./types.js";

export type StatusCardSnapshotDerivation = {
  snapshot: StatusCardSnapshot;
  ids: StatusCardIds;
  flowStageKey: string;
  selection: StatusCardSelection;
  cancelDisabled: boolean;
  cancelError: string;
  cancelCurrentJob: (() => unknown) | undefined;
};

export function useStatusCardSnapshot({
  embedded = false,
  idPrefix = "book-detail-",
  fallbackItem = null,
}: UseStatusCardModelOptions = {}): StatusCardSnapshotDerivation {
  const statusCard = useHomeStatusCard();
  const store = statusCard.store as StatusCardStore;
  const cancelCurrentJob = statusCard.cancelCurrentJob as (() => unknown) | undefined;
  const stateSnapshot = useStoreSnapshot(store) as StatusCardState;
  const rawSnapshot = stateSnapshot.snapshot;
  const snapshot = (embedded
    ? mergeSnapshotWithFallback(rawSnapshot, fallbackItem)
    : rawSnapshot) as StatusCardSnapshot;
  const cancelDisabled = stateSnapshot.cancelDisabled;
  const cancelError = `${stateSnapshot.cancelError || ""}`;

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

  return { snapshot, ids, flowStageKey, selection, cancelDisabled, cancelError, cancelCurrentJob };
}
