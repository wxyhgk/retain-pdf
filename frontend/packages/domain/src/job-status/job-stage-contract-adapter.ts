import {
  firstNonEmpty,
  isJobTerminal,
} from "../job/core.js";
import type { JobLike, JobProgress } from "../job/types.js";
import {
  hasCanonicalEventContract,
  normalizeDisplayStage,
  normalizeUserStage,
  publicStageOf,
} from "./presentation/job-stage-presentation-utils.js";
import {
  summarizeStageDetail,
  summarizeStageKey,
} from "./summary/job-status-summary.js";
import {
  progressWithPercent,
  publicProgressOf,
} from "./progress/job-stage-progress-adapter.js";
import {
  normalizeSubstageKey,
  substageDetail,
} from "./contract/job-stage-substage-contract.js";
import {
  substageMatchesStage,
} from "./presentation/job-stage-presentation-helpers.js";
import type {
  AdaptedStageSnapshot,
  StageEvent,
  StructuredProgress,
} from "./types.js";

export type { AdaptedStageSnapshot, StageEvent } from "./types.js";

function publicStageName(stageKey = ""): string {
  return stageKey === "translate" ? "translation" : stageKey;
}

function internalStageKey(publicStage = ""): string {
  const normalized = normalizeDisplayStage(publicStage);
  return normalized === "translation" ? "translate" : normalized;
}

function progressFromPayload(payload: JobLike = {}): StructuredProgress {
  return progressWithPercent(publicProgressOf(payload));
}

function substageFromPayload(payload: JobLike = {}): string {
  return firstNonEmpty(payload.substage, payload.payload?.substage);
}

function canonicalDetailFromPayload(payload: JobLike = {}, stageKey = ""): string {
  if (!stageKey) {
    return "";
  }
  const substage = normalizeSubstageKey(substageFromPayload(payload));
  if (substage && substageMatchesStage(stageKey, substage)) {
    return substageDetail(substage) || stageKey;
  }
  return stageKey;
}

function detailFromPayload(
  payload: JobLike = {},
  stageKey = "",
  { canonical = false }: { canonical?: boolean } = {},
): string {
  if (canonical) {
    return canonicalDetailFromPayload(payload, stageKey);
  }
  const summarized = summarizeStageDetail(payload);
  if (summarized && summarized !== "等待任务开始") {
    return summarized;
  }
  return firstNonEmpty(payload.stage_detail, payload.payload?.stage_detail, stageKey);
}

export function adaptJobStageSnapshot(payload: JobLike = {}): AdaptedStageSnapshot {
  const explicitPublicStage = publicStageOf(payload);
  const hasCanonicalContract = hasCanonicalEventContract(payload);
  const fallbackStageKey = hasCanonicalContract ? "" : summarizeStageKey(payload);
  const stageKey = explicitPublicStage || fallbackStageKey;
  const progress = progressFromPayload(payload);

  if (isJobTerminal({
    ...payload,
    display_stage: publicStageName(stageKey) || payload.display_stage,
  })) {
    progress.percent = 100;
    if (progress.total !== null && progress.total !== undefined) {
      progress.current = progress.total;
    }
  }

  return {
    jobId: firstNonEmpty(payload.job_id, payload.id),
    status: firstNonEmpty(payload.status),
    publicStage: publicStageName(stageKey),
    stageKey,
    substage: substageFromPayload(payload),
    lane: firstNonEmpty(payload.lane, payload.payload?.lane, "main"),
    progress,
    detail: detailFromPayload(payload, stageKey, { canonical: hasCanonicalContract }),
    source: explicitPublicStage ? "public-stage" : hasCanonicalContract ? "canonical-empty-stage" : "legacy-stage",
    terminal: isJobTerminal({
      ...payload,
      display_stage: publicStageName(stageKey) || payload.display_stage,
    }),
  };
}

export function adaptJobEventStageSnapshot(event: StageEvent = {}): AdaptedStageSnapshot {
  const payload = (event?.payload && typeof event.payload === "object" ? event.payload : {}) as JobLike;
  const displayStage = firstNonEmpty(event.display_stage, payload.display_stage);
  const userStage = firstNonEmpty(event.user_stage, payload.user_stage);
  const canonicalContract = hasCanonicalEventContract(event);
  const stageKey = internalStageKey(displayStage)
    || (canonicalContract ? "" : normalizeUserStage(userStage))
    || (canonicalContract ? "" : summarizeStageKey(event));
  const adapted = adaptJobStageSnapshot({
    ...payload,
    ...event,
    display_stage: displayStage,
    user_stage: canonicalContract ? "" : userStage,
    stage: canonicalContract && !displayStage ? "" : (event.stage || payload.stage) as string,
    substage: (event.substage || payload.substage) as string,
    progress: (event.progress || payload.progress) as JobProgress,
    progress_current: event.progress_current ?? payload.progress_current,
    progress_total: event.progress_total ?? payload.progress_total,
    progress_unit: (event.progress_unit || payload.progress_unit) as string,
  });
  return {
    ...adapted,
    publicStage: publicStageName(stageKey),
    stageKey,
    lane: firstNonEmpty(event.lane, payload.lane, "main"),
    source: displayStage ? "event-contract" : canonicalContract ? "event-contract-empty-stage" : "event-legacy",
  };
}
