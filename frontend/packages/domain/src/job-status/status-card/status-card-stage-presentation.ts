import { resolveRenderStagePresentation } from "../presentation/job-render-stage-presentation.js";
import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "../types.js";

function normalizeStageKey(value = "") {
  return `${value || ""}`.trim();
}

function sameStage(
  base: Partial<PublicStagePresentation> = {},
  override: Partial<PublicStagePresentation> = {},
) {
  const baseStage = normalizeStageKey(base.stageKey);
  const overrideStage = normalizeStageKey(override.stageKey);
  return Boolean(baseStage && overrideStage && baseStage === overrideStage);
}

function mergeSameStagePresentation(
  base: PublicStagePresentation | Record<string, unknown> = {},
  override: Partial<PublicStagePresentation> | Record<string, unknown> = {},
) {
  if (!sameStage(base as Partial<PublicStagePresentation>, override as Partial<PublicStagePresentation>)) {
    return base;
  }
  return {
    ...base,
    ...override,
    stageKey: (base as PublicStagePresentation).stageKey,
    visualStageKey: (override as PublicStagePresentation).visualStageKey
      || (base as PublicStagePresentation).visualStageKey,
    stageKeyTrusted: (base as PublicStagePresentation).stageKeyTrusted,
    stageProgressByKey: (base as PublicStagePresentation).stageProgressByKey,
    backgroundStages: (base as PublicStagePresentation).backgroundStages,
  };
}

export interface ResolveSafeStatusCardStagePresentationOptions {
  state?: unknown;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null;
  stagePresentation?: Partial<PublicStagePresentation> | Record<string, unknown> | null;
}

export function resolveSafeStatusCardStagePresentation({
  state,
  job,
  jobId,
  events,
  stagePresentation = null,
}: ResolveSafeStatusCardStagePresentationOptions = {}) {
  const resolved = resolveRenderStagePresentation({
    state,
    job,
    jobId,
    events,
  });
  return mergeSameStagePresentation(resolved, stagePresentation || {});
}
