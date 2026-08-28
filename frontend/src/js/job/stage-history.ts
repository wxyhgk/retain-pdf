import { isJobTerminal } from "./core.js";
import {
  clampPositiveMs,
  parseIsoTime,
} from "./durations.js";
import type {
  JobDurationOptions,
  JobLike,
  JobPayload,
  StageHistoryEntry,
} from "./types.js";

export function summarizeStageName(stage, detail) {
  const detailText = `${detail || ""}`.trim();
  if (detailText) {
    return detailText;
  }
  const normalizedStage = `${stage || ""}`.trim().toLowerCase();
  if (
    normalizedStage.includes("upload")
    || normalizedStage.includes("submit")
    || normalizedStage.includes("queued")
  ) {
    return "Tải lên PDF";
  }
  if (
    normalizedStage.includes("ocr_processing")
    || normalizedStage.includes("ocr")
    || normalizedStage.includes("mineru")
    || normalizedStage.includes("paddle")
    || normalizedStage.includes("parsing")
    || normalizedStage.includes("normalization")
    || normalizedStage.includes("normaliz")
  ) {
    return "OCR đám mây / Chuẩn hóa";
  }
  if (
    normalizedStage.includes("translation_prepare")
    || normalizedStage.includes("continuation_review")
    || normalizedStage.includes("page_policies")
    || normalizedStage.includes("garbled")
    || normalizedStage.includes("translat")
  ) {
    return "Chuẩn bị dịch / Phán đoán chéo cột chéo trang";
  }
  if (
    normalizedStage.includes("render")
    || normalizedStage.includes("saving")
    || normalizedStage.includes("compile")
    || normalizedStage.includes("overlay")
  ) {
    return "Render PDF";
  }
  switch (normalizedStage) {
    case "queued":
      return "Đang chờ";
    case "running":
      return "Đang xử lý";
    case "translating":
      return "Đang dịch";
    case "parsing":
    case "ocr":
      return "Phân tích / OCR";
    case "translation_prepare":
      return "Chuẩn bị dịch";
    case "rendering":
      return "Đang render";
    case "succeeded":
      return "Đã hoàn thành";
    case "failed":
      return "Thất bại";
    default:
      return `${stage || "-"}`.trim() || "-";
  }
}

function publicStageForHistoryEntry(entry: StageHistoryEntry = {}) {
  return entry.display_stage || entry.user_stage || entry.public_stage || "";
}

function stageDetailForHistoryEntry(entry: StageHistoryEntry = {}) {
  return entry.stage_detail || entry.detail || "";
}

export function stageHistoryDisplay(entry: StageHistoryEntry = {}) {
  const publicStage = publicStageForHistoryEntry(entry);
  const detail = stageDetailForHistoryEntry(entry);
  const title = summarizeStageName(publicStage || entry.stage, detail);
  const stage = publicStage
    ? summarizeStageName(publicStage, "")
    : summarizeStageName(entry.stage, "");
  return {
    title,
    stage,
  };
}

export function resolveStageHistoryDuration(
  entry: StageHistoryEntry | null | undefined,
  job: JobLike | JobPayload | null | undefined,
  {
    finishedAtFallback = "",
    now = null,
  }: JobDurationOptions = {},
) {
  const explicitDuration = clampPositiveMs(entry?.duration_ms);
  if (explicitDuration !== null) {
    return explicitDuration;
  }
  const enterAt = parseIsoTime(entry?.enter_at);
  const exitAt = parseIsoTime(entry?.exit_at);
  if (enterAt && exitAt) {
    return Math.max(0, exitAt.getTime() - enterAt.getTime());
  }
  if (enterAt && !exitAt) {
    const terminal = isJobTerminal(job);
    const currentTime = parseIsoTime(now) || (now instanceof Date ? now : null) || new Date();
    const endAt = terminal
      ? parseIsoTime(job.finished_at || finishedAtFallback || job.updated_at)
      : currentTime;
    if (endAt) {
      return Math.max(0, endAt.getTime() - enterAt.getTime());
    }
  }
  return null;
}

export function resolveStageHistory(job) {
  const directHistory = [
    job?.stage_history,
    job?.runtime?.stage_history,
    job?.runtime?.stageHistory,
    job?.stage_snapshot?.stage_history,
    job?.stageSnapshot?.stageHistory,
  ].find((candidate) => Array.isArray(candidate)) || [];
  return directHistory
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftEnterAt = parseIsoTime(left.entry?.enter_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightEnterAt = parseIsoTime(right.entry?.enter_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftEnterAt !== rightEnterAt) {
        return leftEnterAt - rightEnterAt;
      }
      const leftExitAt = parseIsoTime(left.entry?.exit_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightExitAt = parseIsoTime(right.entry?.exit_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftExitAt !== rightExitAt) {
        return leftExitAt - rightExitAt;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}
