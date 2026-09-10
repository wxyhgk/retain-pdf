import type { JobLike, JobProgress } from "../../job/types.js";
import {
  firstNonEmpty,
} from "../summary/job-status-summary-helpers.js";
import {
  hasCanonicalEventContract,
  hasStructuredProgress,
} from "../contract/job-stage-event-contract.js";
import type { StructuredProgress } from "../types.js";

function progressObjectOf(payload: JobLike = {}): JobProgress {
  return payload?.progress && typeof payload.progress === "object" ? payload.progress : {};
}

function snapshotProgressObjectOf(payload: JobLike = {}): JobProgress {
  return payload?.stage_snapshot?.progress && typeof payload.stage_snapshot.progress === "object"
    ? payload.stage_snapshot.progress
    : {};
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function structuredProgressOf(payload: JobLike = {}): StructuredProgress {
  const progress = progressObjectOf(payload);
  return {
    current: optionalNumber(progress.current),
    total: optionalNumber(progress.total),
    percent: optionalNumber(progress.percent),
    unit: `${progress.unit || ""}`.trim().toLowerCase(),
  };
}

export function legacyProgressOf(payload: JobLike = {}): StructuredProgress {
  return {
    current: optionalNumber(payload.progress_current),
    total: optionalNumber(payload.progress_total),
    percent: optionalNumber(payload.progress_percent),
    unit: firstNonEmpty(payload.progress_unit, payload.payload?.progress_unit).toLowerCase(),
  };
}

export function publicProgressOf(payload: JobLike = {}): StructuredProgress {
  const structured = structuredProgressOf(payload);
  if (
    structured.current !== null
    || structured.total !== null
    || structured.percent !== null
    || structured.unit
  ) {
    return structured;
  }
  const snapshotProgress = progressWithPercent(snapshotProgressObjectOf(payload));
  if (
    snapshotProgress.current !== null
    || snapshotProgress.total !== null
    || snapshotProgress.percent !== null
    || snapshotProgress.unit
  ) {
    return snapshotProgress;
  }
  if (hasStructuredProgress(payload) || hasCanonicalEventContract(payload)) {
    return {
      current: null,
      total: null,
      percent: null,
      unit: "",
    };
  }
  return legacyProgressOf(payload);
}

export function publicProgressUnitOf(payload: JobLike = {}): string {
  return publicProgressOf(payload).unit;
}

export function progressWithPercent(
  progress: JobProgress | StructuredProgress | Record<string, unknown> = {},
): StructuredProgress {
  const current = optionalNumber(progress.current);
  const total = optionalNumber(progress.total);
  let percent = optionalNumber(progress.percent);
  if (percent === null && current !== null && total !== null && total > 0) {
    percent = Math.max(0, Math.min(100, (current / total) * 100));
  }
  return {
    current,
    total,
    percent,
    unit: `${progress.unit || ""}`.trim().toLowerCase(),
  };
}
