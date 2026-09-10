import { createSelector } from "../../internal/selector.js";
import { summarizePublicError } from "../../job/diagnostics.js";
import { buildJobStatusViewModel } from "./job-status-view-model.js";
import {
  resolveSafeStatusCardStagePresentation,
} from "./status-card-stage-presentation.js";
import type { JobLike, JobPayload, ManifestPayload } from "../../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "../types.js";

export interface StatusCardStagePresentationInput {
  state?: unknown;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null;
  stagePresentation?: Partial<PublicStagePresentation> | Record<string, unknown> | null;
}

export interface StatusCardRenderModelOptions {
  state?: unknown;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null | unknown;
  manifest?: ManifestPayload | null | unknown;
  stageActions?: unknown;
  publicErrorText?: string;
  stagePresentation?: Partial<PublicStagePresentation> | Record<string, unknown> | null;
  finishedAtFallback?: string;
}

export interface StatusCardPatchPayloadOptions {
  state?: unknown;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null | unknown;
  manifest?: ManifestPayload | null | unknown;
  stageActions?: unknown;
  publicErrorText?: string | null;
  stagePresentation?: Partial<PublicStagePresentation> | Record<string, unknown> | null;
  finishedAtFallback?: string;
}

export function resolveStatusCardStagePresentation({
  state,
  job,
  jobId,
  events,
  stagePresentation = null,
}: StatusCardStagePresentationInput = {}) {
  return resolveSafeStatusCardStagePresentation({
    state,
    job,
    jobId,
    events,
    stagePresentation,
  });
}

export function buildStatusCardRenderModel({
  state,
  job,
  jobId,
  events,
  manifest,
  stageActions,
  publicErrorText = "",
  stagePresentation = null,
  finishedAtFallback = "",
}: StatusCardRenderModelOptions = {}) {
  const resolvedStagePresentation = resolveStatusCardStagePresentation({
    state,
    job,
    jobId,
    events: events as EventsPayload | null | undefined,
    stagePresentation,
  });
  return buildJobStatusViewModel({
    state,
    job,
    jobId,
    events: events as EventsPayload | null | undefined,
    manifest: manifest as ManifestPayload | null | undefined,
    stageActions,
    publicErrorText,
    stagePresentation: resolvedStagePresentation,
    finishedAtFallback,
  });
}

export function buildStatusCardPatchPayload({
  state,
  job,
  jobId,
  events,
  manifest,
  stageActions,
  publicErrorText = null,
  stagePresentation = null,
  finishedAtFallback = "",
}: StatusCardPatchPayloadOptions = {}) {
  const resolvedPublicErrorText = publicErrorText === null
    ? summarizePublicError(job)
    : publicErrorText;
  const statusViewModel = buildStatusCardRenderModel({
    state,
    job,
    jobId,
    events,
    manifest,
    stageActions,
    publicErrorText: resolvedPublicErrorText,
    stagePresentation,
    finishedAtFallback,
  });
  return {
    job,
    jobId,
    events,
    manifest,
    stageActions,
    publicErrorText: resolvedPublicErrorText,
    statusViewModel,
    stagePresentation: statusViewModel.stagePresentation,
  };
}

export function createStatusCardViewModelSelector(): () => unknown {
  return createSelector([
    (context: StatusCardRenderModelOptions | null | undefined) => context?.state,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.job,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.jobId,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.events,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.manifest,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.stageActions,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.publicErrorText ?? "",
    (context: StatusCardRenderModelOptions | null | undefined) => context?.stagePresentation ?? null,
    (context: StatusCardRenderModelOptions | null | undefined) => context?.finishedAtFallback ?? "",
  ], (
    state: unknown,
    job: JobLike | JobPayload | null | undefined,
    jobId: string | undefined,
    events: unknown,
    manifest: unknown,
    stageActions: unknown,
    publicErrorText: string,
    stagePresentation: unknown,
    finishedAtFallback: string,
  ) => buildStatusCardRenderModel({
    state,
    job: job as JobLike | JobPayload | null | undefined,
    jobId: jobId as string | undefined,
    events: events as EventsPayload | null | undefined,
    manifest: manifest as ManifestPayload | null | undefined,
    stageActions,
    publicErrorText: publicErrorText as string,
    stagePresentation: stagePresentation as Partial<PublicStagePresentation> | Record<string, unknown> | null,
    finishedAtFallback: finishedAtFallback as string,
  }));
}
