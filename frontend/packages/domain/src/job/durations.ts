import { isJobTerminal } from "./core.js";
import { formatRuntimeDuration } from "./formatters.js";
import type {
  JobDurationOptions,
  JobLike,
  JobPayload,
  StageHistoryEntry,
} from "./types.js";

export function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function clampPositiveMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return num;
}

function latestStageHistoryEntry(job: JobLike | JobPayload | null | undefined): StageHistoryEntry | null {
  const history = Array.isArray(job?.stage_history) ? job.stage_history : [];
  if (history.length === 0) {
    return null;
  }
  return history[history.length - 1] || null;
}

export function resolveLiveDurations(
  job: JobLike | JobPayload | null | undefined,
  {
    finishedAtFallback = "",
    now = null,
  }: JobDurationOptions = {},
) {
  if (!job) {
    return {
      stageElapsedText: "-",
      totalElapsedText: "-",
    };
  }

  const terminal = isJobTerminal(job);
  const updatedAt = parseIsoTime(job.updated_at);
  const finishedAt = parseIsoTime(job.finished_at || finishedAtFallback);
  const currentTime = parseIsoTime(now) || (now instanceof Date ? now : null) || new Date();
  const durationEndAt = terminal ? finishedAt || updatedAt || currentTime : currentTime;
  const stageStartedAt = parseIsoTime(job.stage_started_at || job.last_stage_transition_at);
  const jobStartedAt = parseIsoTime(job.started_at || job.created_at);
  const latestStage = latestStageHistoryEntry(job);
  const snapshotDeltaMs = !terminal && updatedAt
    ? Math.max(0, durationEndAt.getTime() - updatedAt.getTime())
    : 0;

  let stageElapsedMs = clampPositiveMs(job.active_stage_elapsed_ms);
  let totalElapsedMs = clampPositiveMs(job.total_elapsed_ms);

  if (terminal) {
    if (stageElapsedMs === null) {
      stageElapsedMs = clampPositiveMs(latestStage?.duration_ms);
    }
    if (totalElapsedMs === null && jobStartedAt) {
      totalElapsedMs = Math.max(0, durationEndAt.getTime() - jobStartedAt.getTime());
    }
  } else {
    if (stageElapsedMs !== null) {
      stageElapsedMs += snapshotDeltaMs;
    } else if (stageStartedAt) {
      stageElapsedMs = Math.max(0, durationEndAt.getTime() - stageStartedAt.getTime());
    } else if (clampPositiveMs(latestStage?.duration_ms) !== null) {
      stageElapsedMs = clampPositiveMs(latestStage?.duration_ms) + snapshotDeltaMs;
    }

    if (totalElapsedMs !== null) {
      totalElapsedMs += snapshotDeltaMs;
    } else if (jobStartedAt) {
      totalElapsedMs = Math.max(0, durationEndAt.getTime() - jobStartedAt.getTime());
    }
  }

  return {
    stageElapsedText: formatRuntimeDuration(stageElapsedMs),
    totalElapsedText: formatRuntimeDuration(totalElapsedMs),
  };
}
