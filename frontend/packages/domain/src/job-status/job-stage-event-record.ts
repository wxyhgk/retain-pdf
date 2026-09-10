import type { JobLike } from "../job/types.js";
import {
  canonicalStageOf,
} from "./presentation/job-stage-presentation-utils.js";
import {
  eventIdentity,
  eventLaneOf,
  hasStructuredProgress,
  hasStructuredPublicStage,
  hasCanonicalEventContract,
  normalizeUserStage,
  progressUnitOf,
  structuredPublicStageOf,
} from "./contract/job-stage-event-contract.js";
import {
  progressFromEvent,
  progressPercentFromEvent,
} from "./progress/job-stage-event-progress.js";
import {
  progressTextForStageProgress,
} from "./summary/job-status-summary-progress.js";
import type { StageEvent, StageEventRecord } from "./types.js";

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function canonicalDisplayStageName(stageKey = ""): string {
  return stageKey === "translate" ? "translation" : stageKey;
}

function progressTextStageKeyForRecord(record: Partial<StageEventRecord> = {}): string {
  if (record.hasCanonicalEventContract) {
    return record.canonicalDisplayStage || record.publicStage || "";
  }
  return record.canonicalDisplayStage
    || record.publicStage
    || normalizeUserStage(record.userStage)
    || "";
}

export function normalizedStageEventRecord(item: StageEvent = {}): StageEventRecord {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const progress = progressFromEvent(item);
  const canonicalDisplayStage = structuredPublicStageOf(item);
  const hasCanonicalContract = hasCanonicalEventContract(item);
  const publicStage = canonicalDisplayStage || (hasCanonicalContract ? "" : canonicalStageOf(item));
  const userStage = publicStage || normalizeUserStage(item?.user_stage || payload.user_stage || "");
  const rawStage = item?.stage || item?.provider_stage || userStage;
  const progressUnit = progressUnitOf(item);
  const identity = eventIdentity(item);

  const record = {
    item,
    lane: eventLaneOf(item) || "main",
    isMainLane: !eventLaneOf(item) || eventLaneOf(item) === "main",
    hasCanonicalEventContract: hasCanonicalContract,
    hasStructuredProgress: hasStructuredProgress(item),
    hasStructuredPublicStage: hasStructuredPublicStage(item),
    publicStage,
    canonicalDisplayStage,
    userStage,
    rawStage,
    substage: `${item?.substage || payload.substage || ""}`.trim(),
    stageDetail: `${item?.stage_detail || payload.stage_detail || ""}`.trim(),
    progress,
    progressPercent: progressPercentFromEvent(item),
    progressUnit,
    seq: identity.seq,
    ts: item?.ts || item?.created_at,
  };
  const displayStage = hasCanonicalContract
    ? firstNonEmptyText(
        item.display_stage,
        payload.display_stage,
        canonicalDisplayStageName(record.publicStage),
      )
    : firstNonEmptyText(
        item.display_stage,
        payload.display_stage,
        item.user_stage,
        payload.user_stage,
        canonicalDisplayStageName(record.publicStage),
        canonicalDisplayStageName(record.userStage),
      );
  const progressTextStageKey = progressTextStageKeyForRecord(record);
  const progressText = progressTextForStageProgress({
    stageKey: progressTextStageKey,
    substageKey: progressTextStageKey ? record.substage : "",
    progress: {
      current: record.progress?.current ?? null,
      total: record.progress?.total ?? null,
      percent: record.progressPercent,
      unit: record.progressUnit,
    },
  });
  const stageText = record.hasCanonicalEventContract
    ? firstNonEmptyText(
        progressText,
        displayStage,
      ) || "-"
    : firstNonEmptyText(
        record.stageDetail,
        progressText,
        displayStage,
        record.rawStage,
      ) || "-";

  return {
    ...record,
    displayStage,
    progressText,
    stageText,
    timestamp: record.ts || item?.ts || item?.created_at,
  };
}

export function eventStageForMatch(item: StageEvent = {}): string {
  const record = normalizedStageEventRecord(item);
  return eventStageForMatchRecord(record);
}

export function eventStageForMatchRecord(record: Partial<StageEventRecord> = {}): string {
  if (record.hasCanonicalEventContract) {
    return `${record.canonicalDisplayStage || ""}`.trim();
  }
  return `${record.publicStage || ""}`.trim();
}

export function structuredStagePayloadFromEventRecord(
  job: JobLike = {},
  record: Partial<StageEventRecord> = {},
): JobLike {
  const displayStage = record.displayStage
    || canonicalDisplayStageName(record.canonicalDisplayStage || record.publicStage || "");
  const progressUnit = record.progressUnit || record.progress?.unit || "";
  const item = record.item as StageEvent | undefined;
  return {
    ...job,
    status: item?.status || job.status || "running",
    lane: record.lane || "",
    display_stage: displayStage,
    user_stage: record.canonicalDisplayStage || record.publicStage || "",
    current_stage: "",
    stage: "",
    internal_stage: "",
    substage: record.substage || "",
    stage_detail: "",
    progress: {
      unit: progressUnit,
      current: record.progress?.current ?? null,
      total: record.progress?.total ?? null,
      percent: record.progressPercent ?? null,
    },
    progress_unit: progressUnit,
    progress_current: record.progress?.current ?? null,
    progress_total: record.progress?.total ?? null,
    progress_percent: record.progressPercent ?? null,
  };
}

export function stagePayloadFromEventRecord(
  job: JobLike = {},
  record: Partial<StageEventRecord> = {},
): JobLike {
  return structuredStagePayloadFromEventRecord(job, record);
}
