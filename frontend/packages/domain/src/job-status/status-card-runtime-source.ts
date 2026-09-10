import {
  buildStatusCardPatchPayload,
  buildStatusCardRenderModel,
} from "./status-card/status-card-context.js";
import type { JobLike, JobPayload, ManifestPayload } from "../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "./types.js";

/** secondaryResourceStore 单条缓存（events / manifest / stageActions） */
export interface SecondaryResourceRecordLike {
  jobId?: string;
  payload?: unknown;
  [key: string]: unknown;
}

/** secondaryResourceStore.getSnapshot() 形状；允许 host 以 Record 宽类型传入 */
export type SecondaryResourceSnapshot =
  | Record<string, SecondaryResourceRecordLike | null | undefined>
  | Record<string, unknown>
  | null
  | undefined;

export interface StatusCardRuntimeLike {
  state?: unknown;
  finishedAtFallback?: (() => string) | string | null;
}

export interface StatusCardPresentationOverride {
  publicErrorText?: string;
  stagePresentation?: PublicStagePresentation | Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface CurrentJobSnapshotLike {
  jobId?: string;
  snapshot?: JobLike | JobPayload | null;
  [key: string]: unknown;
}

export interface BuildRuntimeStatusCardViewModelOptions {
  runtime?: StatusCardRuntimeLike | null;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null | unknown;
  manifest?: ManifestPayload | null | unknown;
  stageActions?: unknown;
  publicErrorText?: string;
  stagePresentation?: PublicStagePresentation | Record<string, unknown> | null;
}

export interface BuildRuntimeStatusCardPatchPayloadOptions {
  runtime?: StatusCardRuntimeLike | null;
  job?: JobLike | JobPayload | null;
  jobId?: string;
  events?: EventsPayload | null | unknown;
  manifest?: ManifestPayload | null | unknown;
  stageActions?: unknown;
}

export interface BuildRuntimeStatusCardSnapshotOptions {
  currentJob?: CurrentJobSnapshotLike | null;
  presentationOverride?: StatusCardPresentationOverride | null;
  secondaryResources?: SecondaryResourceSnapshot;
  state?: unknown;
  finishedAtFallback?: (() => string) | string;
}

export function secondaryPayloadForStatusCardJob(
  secondarySnapshot: SecondaryResourceSnapshot = {},
  type = "",
  jobId = "",
) {
  const raw = secondarySnapshot?.[type] || null;
  const record = (raw && typeof raw === "object")
    ? raw as SecondaryResourceRecordLike
    : null;
  return record?.jobId === jobId ? record.payload : null;
}

export function finishedAtFallbackForStatusCardRuntime(
  runtime: StatusCardRuntimeLike | null | undefined = null,
) {
  return typeof runtime?.finishedAtFallback === "function"
    ? runtime.finishedAtFallback()
    : "";
}

export function buildRuntimeStatusCardViewModel({
  runtime,
  job,
  jobId,
  events,
  manifest,
  stageActions,
  publicErrorText = "",
  stagePresentation = null,
}: BuildRuntimeStatusCardViewModelOptions = {}) {
  return buildStatusCardRenderModel({
    state: runtime?.state || null,
    job,
    jobId,
    events,
    manifest,
    stageActions,
    publicErrorText,
    stagePresentation,
    finishedAtFallback: finishedAtFallbackForStatusCardRuntime(runtime),
  });
}

export function buildRuntimeStatusCardPatchPayload({
  runtime,
  job,
  jobId,
  events,
  manifest,
  stageActions,
}: BuildRuntimeStatusCardPatchPayloadOptions = {}) {
  return buildStatusCardPatchPayload({
    state: runtime?.state || null,
    job,
    jobId,
    events,
    manifest,
    stageActions,
    finishedAtFallback: finishedAtFallbackForStatusCardRuntime(runtime),
  });
}

export function buildRuntimeStatusCardSnapshot({
  currentJob,
  presentationOverride,
  secondaryResources,
  state = null,
  finishedAtFallback = "",
}: BuildRuntimeStatusCardSnapshotOptions = {}) {
  const jobId = `${currentJob?.jobId || ""}`.trim();
  const job = currentJob?.snapshot || null;
  if (!job || !jobId) {
    return null;
  }
  return buildRuntimeStatusCardViewModel({
    runtime: {
      state,
      finishedAtFallback: typeof finishedAtFallback === "function"
        ? finishedAtFallback
        : () => finishedAtFallback,
    },
    job,
    jobId,
    events: secondaryPayloadForStatusCardJob(secondaryResources, "events", jobId) as EventsPayload | null,
    manifest: secondaryPayloadForStatusCardJob(secondaryResources, "manifest", jobId) as ManifestPayload | null,
    stageActions: secondaryPayloadForStatusCardJob(secondaryResources, "stageActions", jobId),
    publicErrorText: presentationOverride?.publicErrorText || "",
    stagePresentation: presentationOverride?.stagePresentation || null,
  });
}
