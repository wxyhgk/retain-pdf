import { buildJobImageCandidateUrls } from "@retainpdf/api/job-images";
import {
  clampRuntimeStageKeyForJob,
  isJobTerminal,
  normalizeRuntimeDisplayStage,
} from "../recent-jobs/runtime-value-helpers.js";
import { escapeAttribute, truncateDisplayName } from "@/platform/utils/html-formatting.js";
import { JOB_STATUS_LABELS, isActiveJobStatus, jobStatusLabel, normalizeJobStatus } from "@retainpdf/domain/job";

export function recentJobStatusLabel(status) {
  return jobStatusLabel(status, { idleLabel: "-" });
}

const RECENT_JOB_STAGE_KEYS = new Set(["ocr", "translate", "render", "done", "queued", "failed", "canceled"]);
const IGNORED_SNAPSHOT_SOURCES = new Set(["legacy-stage", "canonical-empty-stage"]);

function normalizedMergedStage(value = "") {
  const stage = normalizeRuntimeDisplayStage(value);
  return RECENT_JOB_STAGE_KEYS.has(stage) ? stage : "";
}

function trustedStageSnapshot(item: any = {}) {
  const snapshot = item.stage_snapshot && typeof item.stage_snapshot === "object"
    ? item.stage_snapshot
    : null;
  const source = `${snapshot?.source || ""}`.trim();
  return snapshot && !IGNORED_SNAPSHOT_SOURCES.has(source) ? snapshot : null;
}

export function stageKeyForRecentJobLabel(item: any = {}) {
  const snapshot = trustedStageSnapshot(item);
  const rawStage = normalizedMergedStage(item.display_stage)
    || normalizedMergedStage(item.runtime_status?.publicStage)
    || normalizedMergedStage(item.runtime_status?.stageKey)
    || normalizedMergedStage(snapshot?.publicStage)
    || normalizedMergedStage(snapshot?.stageKey);
  const stageKey = clampRuntimeStageKeyForJob(rawStage, item);
  if (stageKey) {
    return stageKey;
  }
  switch (normalizeJobStatus(item.status)) {
    case "succeeded":
      return "done";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "queued":
      return "queued";
    default:
      return "";
  }
}

export function recentJobStageLabel(item) {
  switch (stageKeyForRecentJobLabel(item)) {
    case "ocr":
      return "OCR 中";
    case "translate":
      return "翻译中";
    case "render":
      return "渲染中";
    case "done":
      return JOB_STATUS_LABELS.succeeded;
    case "queued":
      return JOB_STATUS_LABELS.queued;
    case "failed":
      return JOB_STATUS_LABELS.failed;
    case "canceled":
      return JOB_STATUS_LABELS.canceled;
    default:
      return normalizeJobStatus(item?.status) === "queued" ? JOB_STATUS_LABELS.queued : JOB_STATUS_LABELS.running;
  }
}

export function recentJobProgressPercent(item) {
  const progress = item?.runtime_status?.progress && typeof item.runtime_status.progress === "object"
    ? item.runtime_status.progress
    : item?.progress;
  const percent = Number(progress?.percent);
  if (Number.isFinite(percent)) {
    return Math.max(0, Math.min(100, percent));
  }
  const current = Number(progress?.current);
  const total = Number(progress?.total);
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, (current / total) * 100));
  }
  return NaN;
}

export function isRecentJobActive(item) {
  if (isActiveJobStatus(item?.status)) {
    return true;
  }
  // isJobTerminal 已覆盖 failed/canceled，无需再手写一份状态集合。
  if (isJobTerminal(item)) {
    return false;
  }
  const percent = recentJobProgressPercent(item);
  return Number.isFinite(percent) && percent > 0 && percent < 100;
}

export function recentJobTitle(item) {
  return truncateDisplayName(item.title || item.display_name || item.source_file_name || item.job_id || "-");
}

export function recentJobRawImageUrl(item) {
  return recentJobRawImageUrls(item)[0] || "";
}

export function recentJobRawImageUrls(item) {
  return buildJobImageCandidateUrls(item);
}

export function recentJobImageUrl(item) {
  return escapeAttribute(recentJobRawImageUrl(item));
}

export function buildReaderUrl(item) {
  const jobId = [item?.job_id, item?.active_job_id]
    .map((value) => `${value || ""}`.trim())
    .find((value) => value && !value.startsWith("doc:")) || "";
  if (jobId && !jobId.startsWith("doc:")) {
    return `./reader.html?job_id=${encodeURIComponent(jobId)}`;
  }
  const documentId = `${item?.document_id || ""}`.trim();
  return documentId ? `./reader.html?document_id=${encodeURIComponent(documentId)}` : "#";
}
