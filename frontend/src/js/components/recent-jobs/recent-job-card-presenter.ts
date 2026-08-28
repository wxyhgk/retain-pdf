import { buildJobImageCandidateUrls } from "../../api/job-images.js";
import {
  clampRuntimeStageKeyForJob,
  isJobTerminal,
  normalizeRuntimeDisplayStage,
} from "../../features/recent-jobs/runtime-value-helpers.js";
import { escapeAttribute, truncateDisplayName } from "../../utils/html-formatting.js";

export function recentJobStatusLabel(status) {
  switch (`${status || ""}`.trim()) {
    case "queued":
      return "Đang chờ";
    case "running":
      return "Đang chạy";
    case "succeeded":
      return "Đã hoàn thành";
    case "failed":
      return "Thất bại";
    case "canceled":
    case "cancelled":
      return "Đã hủy";
    default:
      return status || "-";
  }
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
  switch (`${item.status || ""}`.trim().toLowerCase()) {
    case "succeeded":
      return "done";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
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
      return "Đang OCR";
    case "translate":
      return "Đang dịch";
    case "render":
      return "Đang render";
    case "done":
      return "Đã hoàn thành";
    case "queued":
      return "Đang chờ";
    case "failed":
      return "Thất bại";
    case "canceled":
      return "Đã hủy";
    default:
      return `${item?.status || ""}`.trim() === "queued" ? "Đang chờ" : "Đang xử lý";
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
  const status = `${item?.status || ""}`.trim();
  if (status === "queued" || status === "running") {
    return true;
  }
  if (isJobTerminal(item) || status === "failed" || status === "canceled") {
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
  const jobId = `${item?.job_id || ""}`.trim();
  return jobId ? `./reader.html?job_id=${encodeURIComponent(jobId)}` : "#";
}
