import { currentStageProgressViewModel } from "../stage-progress-view-model.js";
import { isStatusStageKey } from "../stage-flow-model.js";
import type { ProgressRecord, StageProgressViewSnapshot } from "../types.js";

function selectedProgressUnit(progress: ProgressRecord = {}): string {
  return `${progress?.progressUnit || progress?.progress_unit || ""}`.trim();
}

function hasFiniteProgress(progress: ProgressRecord = {}): boolean {
  const current = Number(progress?.current ?? progress?.progressCurrent);
  const total = Number(progress?.total ?? progress?.progressTotal);
  return Number.isFinite(current) && Number.isFinite(total) && total > 0;
}

function isConcreteProgressUnit(unit = ""): boolean {
  return ["page", "batch", "step", "none"].includes(`${unit || ""}`.trim());
}

function shouldPreferSubstageProgress(
  progress: ProgressRecord = {},
  substageFallback: ProgressRecord | null = null,
): boolean {
  if (!substageFallback || !hasFiniteProgress(substageFallback)) {
    return false;
  }
  const fallbackUnit = selectedProgressUnit(substageFallback);
  if (!isConcreteProgressUnit(fallbackUnit)) {
    return false;
  }
  const progressUnit = selectedProgressUnit(progress);
  if (progressUnit === "percent" || !isConcreteProgressUnit(progressUnit)) {
    return true;
  }
  return false;
}

export function normalizeSelectedProgress(
  progress: ProgressRecord | null | undefined = {},
  fallback: ProgressRecord | null | undefined = {},
): ProgressRecord {
  const fallbackBySubstage = fallback?.bySubstage || {};
  const progressSubstageKey = progress?.substageKey || fallback?.substageKey || "";
  const substageFallback = progressSubstageKey ? fallbackBySubstage[progressSubstageKey] : null;
  const primaryProgress = shouldPreferSubstageProgress(progress, substageFallback)
    ? substageFallback
    : progress;
  const current = Number(primaryProgress?.current ?? primaryProgress?.progressCurrent ?? substageFallback?.current ?? substageFallback?.progressCurrent ?? fallback?.current ?? fallback?.progressCurrent);
  const total = Number(primaryProgress?.total ?? primaryProgress?.progressTotal ?? substageFallback?.total ?? substageFallback?.progressTotal ?? fallback?.total ?? fallback?.progressTotal);
  return {
    current: Number.isFinite(current) ? current : NaN,
    total: Number.isFinite(total) ? total : NaN,
    displayPercent: primaryProgress?.displayPercent ?? substageFallback?.displayPercent ?? fallback?.displayPercent ?? null,
    progressText: primaryProgress?.progressText || substageFallback?.progressText || fallback?.progressText || "",
    progressUnit: primaryProgress?.progressUnit || substageFallback?.progressUnit || fallback?.progressUnit || "",
    indeterminate: Boolean(primaryProgress?.indeterminate ?? primaryProgress?.progressIndeterminate ?? substageFallback?.indeterminate ?? substageFallback?.progressIndeterminate ?? fallback?.indeterminate ?? fallback?.progressIndeterminate),
    substageKey: progressSubstageKey,
    visualStageKey: primaryProgress?.visualStageKey || substageFallback?.visualStageKey || fallback?.visualStageKey || "",
    bySubstage: progress?.bySubstage || fallback?.bySubstage || {},
  };
}

export function effectiveFlowStageKey(snapshot: StageProgressViewSnapshot | null = null): string {
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  return isStatusStageKey(stageKey) ? stageKey : "";
}

export function resolveSelectedStageContext({
  snapshot,
  selectedStageKey = "",
}: {
  snapshot: StageProgressViewSnapshot;
  selectedStageKey?: string;
}) {
  const flowStageKey = effectiveFlowStageKey(snapshot);
  const selected = selectedStageKey || flowStageKey;
  const selectedIsCurrent = selected === snapshot.stageKey;
  const selectedHistoricalProgress = selectedIsCurrent ? null : snapshot.stageProgressByKey?.[selected];
  const currentProgress = currentStageProgressViewModel(snapshot, { normalizeSelectedProgress });
  const selectedProgress = selectedIsCurrent
    ? normalizeSelectedProgress(currentProgress, snapshot.stageProgressByKey?.[selected])
    : normalizeSelectedProgress(selectedHistoricalProgress);
  return {
    flowStageKey,
    selected,
    selectedHistoricalProgress,
    selectedIsCurrent,
    selectedProgress,
  };
}
