import type { JobLike } from "../../job/types.js";
import {
  summarizeStageKey,
} from "../summary/job-status-summary.js";
import {
  progressTextForStageProgress,
} from "../summary/job-status-summary-progress.js";
import { hasCanonicalEventContract } from "./job-stage-event-contract.js";
import {
  eventStageForMatchRecord,
  normalizedStageEventRecord,
  stagePayloadFromEventRecord,
} from "../job-stage-event-record.js";
import {
  visualStageKeyForSubstage,
  normalizeSubstageKey,
} from "./job-stage-substage-contract.js";
import type { ProgressRecord, StageEvent, StageEventRecord } from "../types.js";

function normalizedStageKey(value = ""): string {
  const stageKey = `${value || ""}`.trim();
  return stageKey === "translation" ? "translate" : stageKey;
}

export function stagePayloadFromEvent(
  job: JobLike,
  item: StageEvent,
  progress: { current?: number | null; total?: number | null; unit?: string; percent?: number | null },
) {
  const record = normalizedStageEventRecord(item);
  return stagePayloadFromEventRecord(job, {
    ...record,
    progress: {
      current: progress.current ?? null,
      total: progress.total ?? null,
      unit: progress.unit,
      percent: progress.percent,
    },
  });
}

export function visualStageKeyForEventPayload(payload: JobLike = {}, stageKey = ""): string {
  const nestedPayload = payload?.payload && typeof payload.payload === "object" ? payload.payload : {};
  const substage = `${payload?.substage || nestedPayload.substage || ""}`.trim().toLowerCase();
  const structuredVisualStageKey = visualStageKeyForSubstage(stageKey, substage);
  if (structuredVisualStageKey) {
    return structuredVisualStageKey;
  }
  if (hasCanonicalEventContract(payload)) {
    return stageKey;
  }
  return stageKey;
}

function stageKeyForProgressRecord(
  record: Partial<StageEventRecord> = {},
  itemStage = "",
  payload: JobLike = {},
): string {
  const publicStage = normalizedStageKey(record.canonicalDisplayStage || record.publicStage || itemStage);
  if (["ocr", "translate", "render"].includes(publicStage)) {
    return publicStage;
  }
  if (record.hasCanonicalEventContract) {
    return "";
  }
  return summarizeStageKey(payload);
}

function substageKeyForProgressRecord(
  record: Partial<StageEventRecord> = {},
  stageKey = "",
  payload: JobLike = {},
): string {
  const structuredSubstage = normalizeSubstageKey(record.substage);
  if (structuredSubstage) {
    return structuredSubstage;
  }
  const structuredStageSubstage = stageKey === "translate"
    ? normalizeSubstageKey(record.rawStage)
    : "";
  if (structuredStageSubstage) {
    return structuredStageSubstage;
  }
  if (record.hasCanonicalEventContract) {
    return "";
  }
  const nestedPayload = payload.payload && typeof payload.payload === "object" ? payload.payload : {};
  const payloadCandidates = [
    payload.substage,
    nestedPayload.substage,
    payload.stage,
    payload.current_stage,
    payload.internal_stage,
  ];
  for (const candidate of payloadCandidates) {
    const payloadSubstage = normalizeSubstageKey(
      typeof candidate === "string" ? candidate : `${candidate ?? ""}`,
    );
    if (payloadSubstage) {
      return payloadSubstage;
    }
  }
  return "";
}

function visualStageKeyForProgressRecord(
  record: Partial<StageEventRecord> = {},
  stageKey = "",
  payload: JobLike = {},
): string {
  const structuredVisualStageKey = visualStageKeyForSubstage(stageKey, record.substage);
  if (structuredVisualStageKey) {
    return structuredVisualStageKey;
  }
  if (record.hasCanonicalEventContract) {
    return stageKey;
  }
  return visualStageKeyForEventPayload(payload, stageKey);
}

export function normalizeProgressRecord(
  job: JobLike,
  item: StageEvent,
  itemStage: string,
  options: Record<string, unknown> = {},
): ProgressRecord | null {
  const record = normalizedStageEventRecord(item);
  return normalizeProgressRecordFromEventRecord(job, record, itemStage, options);
}

export function normalizeProgressRecordFromEventRecord(
  job: JobLike = {},
  record: StageEventRecord = {} as StageEventRecord,
  itemStage = "",
  options: Record<string, unknown> = {},
): ProgressRecord | null {
  const { progress, progressPercent } = record;
  if (
    (progress.current === null || progress.total === null || progress.total <= 0)
    && progressPercent === null
    && !record.hasStructuredProgress
  ) {
    return null;
  }
  const item = record.item || {};
  const stageForPayload = eventStageForMatchRecord(record) || itemStage;
  const payload = stagePayloadFromEventRecord(job, {
    ...record,
    rawStage: stageForPayload,
    progress,
  });
  const stageKey = stageKeyForProgressRecord(record, itemStage, payload);
  if (!["ocr", "translate", "render"].includes(stageKey)) {
    return null;
  }
  const displayPayload = { ...payload };
  const visualStageKey = visualStageKeyForProgressRecord(record, stageKey, displayPayload);
  const substageKey = substageKeyForProgressRecord(record, stageKey, displayPayload);
  const progressUnit = record.progressUnit || displayPayload.progress?.unit || displayPayload.progress_unit || "";
  return {
    item,
    payload: displayPayload,
    stageKey,
    current: progress.current,
    total: progress.total,
    progressPercent,
    progressUnit,
    progressText: progressTextForStageProgress({
      stageKey,
      substageKey,
      progress: {
        current: progress.current,
        total: progress.total,
        percent: progressPercent,
        unit: progressUnit,
      },
    }),
    visualStageKey,
    substageKey,
    indeterminate: stageKey === "ocr" && progress.current <= 0 && progress.total > 0,
    seq: record.seq,
    ts: record.ts,
  };
}
