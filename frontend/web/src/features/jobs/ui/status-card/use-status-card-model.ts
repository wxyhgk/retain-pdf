// StatusCard 共享模型编排：store → snapshot → display / lottie / progress。
// Main 与 Embedded 只消费本 hook 的返回值，不各自再拼一遍。

import { useHomeReader, useHomeStatusDetail } from "@/ui/context/home-services-context.js";
import { describeStatusCardCancel } from "./cancellation.js";
import { normalizeStatusCardFlowKey, resolveStatusCardSelectedRetry } from "./retry.js";
import { useStatusCardDisplay } from "./use-status-card-display.js";
import { useStatusCardElapsed } from "./use-status-card-elapsed.js";
import { useStatusCardMedia } from "./use-status-card-media.js";
import { useStatusCardSnapshot } from "./use-status-card-snapshot.js";
import type { StatusCardModel, UseStatusCardModelOptions } from "./types.js";

export function useStatusCardModel({
  embedded = false,
  idPrefix = "book-detail-",
  fallbackItem = null,
}: UseStatusCardModelOptions = {}): StatusCardModel {
  const reader = useHomeReader();

  const {
    snapshot,
    ids,
    flowStageKey,
    selection,
    cancelDisabled,
    cancelError,
    cancelCurrentJob,
  } = useStatusCardSnapshot({ embedded, idPrefix, fallbackItem });

  const {
    display,
    displaySnapshot,
    visualStageKey,
    ringLabel,
    stageKeyForFlow,
    selectedForFlow,
  } = useStatusCardDisplay({ snapshot, flowStageKey, selection });

  const elapsed = useStatusCardElapsed(snapshot);

  const { lottie, renderOptions } = useStatusCardMedia({
    display,
    displaySnapshot,
    flowStageKey,
    visualStageKey,
    snapshot,
  });

  const statusDetail = useHomeStatusDetail();

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
    statusDetail.controller.openStatusDetailDialog("overview");
  };

  return {
    reader,
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
    cancelError,
    cancelCurrentJob,
    cancel,
    selectedRetry,
    openDetail,
    visualStageKey,
  };
}
