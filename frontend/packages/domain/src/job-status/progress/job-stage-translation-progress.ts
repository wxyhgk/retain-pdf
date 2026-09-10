import type { JobLike, JobProgress } from "../../job/types.js";
import {
  normalizeSubstageKey,
  substageDetail,
  substageProgressRange,
} from "../contract/job-stage-substage-contract.js";
import type { ProgressRecord } from "../types.js";

function percentForProgress(progress: ProgressRecord | JobProgress | null | undefined): number | null {
  const rawCurrent = progress?.current;
  const rawTotal = progress?.total;
  const current = Number(rawCurrent);
  const total = Number(rawTotal);
  if (rawCurrent !== null && rawCurrent !== undefined && rawTotal !== null && rawTotal !== undefined && Number.isFinite(current) && Number.isFinite(total)) {
    if (total > 0) {
      return Math.max(0, Math.min(1, current / total));
    }
    return current >= 0 ? 1 : null;
  }
  const progressRecord = progress as ProgressRecord | null | undefined;
  const percent = Number(progressRecord?.progressPercent);
  if (Number.isFinite(percent)) {
    return Math.max(0, Math.min(1, percent > 1 ? percent / 100 : percent));
  }
  return null;
}

function clampPercent(value: unknown): number | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return Math.max(0, Math.min(100, numericValue));
}

function localPercentForSubstage(ratio: number | null = null): number | null {
  const safeRatio = ratio === null || ratio === undefined
    ? 0
    : Math.max(0, Math.min(1, Number(ratio)));
  if (!Number.isFinite(safeRatio)) {
    return null;
  }
  return clampPercent(safeRatio * 100);
}

function hasMeasurableProgress(progress: ProgressRecord | null | undefined): boolean {
  const current = Number(progress?.current);
  const total = Number(progress?.total);
  return Number.isFinite(current) && Number.isFinite(total) && total > 0;
}

function sourceProgressUnitForRecord(progressRecord: ProgressRecord = {}): string {
  const payload = progressRecord.payload as JobLike | undefined;
  const payloadProgress = payload?.progress && typeof payload.progress === "object"
    ? payload.progress
    : undefined;
  return `${progressRecord.sourceProgressUnit
    || progressRecord.progressUnit
    || payloadProgress?.unit
    || payload?.progress_unit
    || ""}`.trim();
}

function translationSubstageKeyForRecord(progressRecord: ProgressRecord = {}): string {
  const payload = progressRecord.payload as JobLike | undefined;
  const candidates = [
    progressRecord.substageKey,
    progressRecord.visualStageKey,
    payload?.substage,
    payload?.stage,
    payload?.current_stage,
    payload?.internal_stage,
    payload?.stage_detail,
    payload?.message,
  ];
  for (const candidate of candidates) {
    const key = normalizeSubstageKey(`${candidate || ""}`);
    if (key && substageProgressRange(key)) {
      return key;
    }
  }
  const unit = sourceProgressUnitForRecord(progressRecord);
  if (unit === "batch") {
    return "translation_batches";
  }
  return "";
}

function fallbackRatioForSubstage(progressRecord: ProgressRecord = {}, substageKey = ""): number | null {
  if (!substageKey) {
    return null;
  }
  const payload = progressRecord.payload as JobLike | undefined;
  const hasProgressSignal = Boolean(sourceProgressUnitForRecord(progressRecord))
    || Boolean(payload?.progress && typeof payload.progress === "object");
  return hasProgressSignal ? 0 : null;
}

function fallbackProgressForRecord(
  progressRecord: ProgressRecord = {},
  substageKey = "",
): { current: number; total: number; progressUnit: string } | null {
  if (!substageKey) {
    return null;
  }
  const ratio = percentForProgress(progressRecord) ?? fallbackRatioForSubstage(progressRecord, substageKey);
  if (ratio === null) {
    return null;
  }
  return {
    current: Math.round(ratio * 100),
    total: 100,
    progressUnit: "percent",
  };
}

function progressTextForRecord(
  progressRecord: ProgressRecord = {},
  substageKey = "",
  ratio: number | null = null,
): string {
  const sourceUnit = sourceProgressUnitForRecord(progressRecord);
  const hasMeasurableTotal = Number(progressRecord.total) > 0;
  if (sourceUnit === "none" || !hasMeasurableTotal) {
    return substageDetail(substageKey) || progressRecord.progressText || "";
  }
  if (substageKey === "translation_batches" && ratio >= 1) {
    return "翻译批次完成";
  }
  return progressRecord.progressText || substageDetail(substageKey) || "";
}

export function compositeTranslationProgressFromRecord(
  progressRecord: ProgressRecord | null | undefined = null,
): ProgressRecord | null | undefined {
  if (!progressRecord || progressRecord.stageKey !== "translate") {
    return progressRecord;
  }
  const substageKey = translationSubstageKeyForRecord(progressRecord);
  if (!substageProgressRange(substageKey)) {
    return progressRecord;
  }
  const ratio = percentForProgress(progressRecord) ?? fallbackRatioForSubstage(progressRecord, substageKey);
  const fallbackProgress = fallbackProgressForRecord(progressRecord, substageKey);
  if (!hasMeasurableProgress(progressRecord) && !fallbackProgress) {
    return progressRecord;
  }
  const measured = hasMeasurableProgress(progressRecord);
  const progressUnit = measured ? progressRecord.progressUnit : fallbackProgress.progressUnit;
  const payload = (progressRecord.payload || {}) as JobLike;
  return {
    ...progressRecord,
    current: measured ? progressRecord.current : fallbackProgress.current,
    total: measured ? progressRecord.total : fallbackProgress.total,
    displayPercent: localPercentForSubstage(ratio),
    progressUnit,
    sourceProgressUnit: sourceProgressUnitForRecord(progressRecord),
    progressText: progressTextForRecord(progressRecord, substageKey, ratio),
    substageKey,
    payload: {
      ...payload,
      substage: payload?.substage || substageKey,
      progress_unit: progressUnit,
    },
    indeterminate: false,
  };
}
