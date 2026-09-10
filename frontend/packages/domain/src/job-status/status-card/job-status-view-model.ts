import { resolveLiveDurations } from "../../job/durations.js";
import { collectStageProgressByKey } from "../presentation/job-stage-presentation.js";
import { buildStatusCardResultActions } from "./status-card-result-actions-view-model.js";
import { buildStatusCardRetryActions } from "./status-card-retry-actions-view-model.js";
import { buildStatusCardTaskActions } from "./status-card-task-actions-view-model.js";
import {
  resolveSafeStatusCardStagePresentation,
} from "./status-card-stage-presentation.js";

export function buildJobStatusViewModel({
  state,
  job,
  jobId,
  events,
  manifest,
  stageActions,
  publicErrorText,
  stagePresentation = null,
  finishedAtFallback = "",
}: any) {
  const resolvedStagePresentation = resolveSafeStatusCardStagePresentation({
    state,
    job,
    jobId,
    events,
    stagePresentation,
  });
  const resultActions = buildStatusCardResultActions({ job, manifest });
  const taskActions = buildStatusCardTaskActions({ job });
  return {
    job,
    jobId: job?.job_id || jobId || "",
    status: job?.status || "idle",
    stagePresentation: resolvedStagePresentation,
    label: resolvedStagePresentation.label,
    value: resolvedStagePresentation.detail || "准备中",
    detail: "",
    stageKey: resolvedStagePresentation.stageKey,
    visualStageKey: resolvedStagePresentation.visualStageKey,
    elapsed: resolveLiveDurations(job, { finishedAtFallback }).totalElapsedText,
    progressCurrent: resolvedStagePresentation.progressCurrent,
    progressTotal: resolvedStagePresentation.progressTotal,
    progressFallbackText: "-",
    displayPercent: resolvedStagePresentation.displayPercent ?? null,
    progressPercent: resolvedStagePresentation.progressPercent ?? job?.progress_percent,
    progressText: resolvedStagePresentation.progressText,
    progressUnit: resolvedStagePresentation.progressUnit,
    progressIndeterminate: resolvedStagePresentation.progressIndeterminate,
    substageKey: resolvedStagePresentation.substageKey,
    backgroundStages: resolvedStagePresentation.backgroundStages || [],
    errorText: publicErrorText === "-" ? "" : publicErrorText,
    stageProgressByKey: resolvedStagePresentation.stageProgressByKey || collectStageProgressByKey(job, events),
    stageRetryActions: buildStatusCardRetryActions(stageActions),
    ...resultActions,
    ...taskActions,
  };
}
