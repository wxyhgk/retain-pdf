// frontend/packages/domain/src/job-status/job-detail-status-view-model.ts — pure job-detail status view-models
// Extracted verbatim from frontend/web/src/js/job-detail/status-view-model.ts.
import { resolveDisplayedStagePresentation } from "./presentation/job-stage-presentation.js";
import { normalizedStageEventRecord } from "./job-stage-event-record.js";
import { adaptJobEventStageSnapshot } from "./job-stage-contract-adapter.js";
import type {
  EventsPayload,
  PublicStagePresentation,
  StageEvent,
} from "./types.js";
import { summarizeRuntimeField } from "../job/formatters.js";
import type { JobLike } from "../job/types.js";

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function numberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function runtimeStageText(
  job: JobLike = {},
  presentation: Partial<PublicStagePresentation> = {},
): string {
  const snapshot = job.stage_snapshot as { publicStage?: string } | null | undefined;
  return firstNonEmptyText(
    presentation.detail,
    presentation.progressText,
    snapshot?.publicStage,
    (job as { display_stage?: string }).display_stage,
  );
}

export function buildJobDetailStatusViewModel(
  job: JobLike = {},
  eventsPayload: EventsPayload | null = null,
) {
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload) as PublicStagePresentation;
  return {
    stageDetail: presentation.detail || "-",
    runtimeCurrentStage: summarizeRuntimeField(runtimeStageText(job, presentation)),
    progressText: presentation.progressText || "",
    stageKey: presentation.stageKey || "",
    visualStageKey: presentation.visualStageKey || presentation.stageKey || "",
  };
}

export function buildJobDetailEventViewModel(item: StageEvent = {}) {
  const record = normalizedStageEventRecord(item);
  const snapshot = adaptJobEventStageSnapshot(item);
  const progressCurrent = numberOrNull(snapshot.progress?.current);
  const progressTotal = numberOrNull(snapshot.progress?.total);
  const progressUnit = `${snapshot.progress?.unit || ""}`.trim();

  return {
    event: firstNonEmptyText(item.event, item.raw_event_type, item.event_type) || "-",
    level: firstNonEmptyText((item as { level?: unknown }).level) || "-",
    timestamp: record.timestamp,
    stageText: record.stageText,
    displayStage: snapshot.publicStage || "",
    substage: snapshot.substage || record.substage,
    lane: snapshot.lane || record.lane,
    eventType: firstNonEmptyText(item.event_type),
    rawEventType: firstNonEmptyText(item.raw_event_type),
    provider: firstNonEmptyText((item as { provider?: unknown }).provider),
    providerStage: firstNonEmptyText((item as { provider_stage?: unknown }).provider_stage),
    message: firstNonEmptyText((item as { message?: unknown }).message) || "-",
    payload: (item as { payload?: unknown }).payload,
    progressCurrent,
    progressTotal,
    progressUnit,
    progressText: record.progressText,
    retryCount: numberOrNull((item as { retry_count?: unknown })?.retry_count),
    elapsedMs: numberOrNull((item as { elapsed_ms?: unknown })?.elapsed_ms),
    seq: (item as { seq?: unknown })?.seq ?? "-",
  };
}
