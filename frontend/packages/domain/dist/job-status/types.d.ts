/**
 * Shared types for the job-status engine (stage contract, display state, progress).
 * Built from public-stage-engine, contract adapter, and status-card usage.
 *
 * Source of truth: `contracts/job-status.v1.schema.json`
 * (JobProgressView / JobStageSnapshotView / JobStagesView / JobTimestampsView).
 * Rust origin: `backend/packages/retain-core/src/models/view/{job_types.rs, common.rs}`.
 * Contract test: `tests/job-status-contract.test.mjs` locks `stage_snapshot/progress/percent/unit` and `JobStageStateView`.
 * TODO: replace hand-written progress/stage types with generated types from schemas.
 */
import type { JobLane, JobLike, JobPayload, JobProgress, JobStatus, ProgressUnit, PublicStage, StageKey, StageSnapshot } from "../job/types.js";
export type { JobLane, JobLike, JobPayload, JobProgress, JobStatus, ProgressUnit, PublicStage, StageKey, StageSnapshot, };
/** Structured progress used by progress adapters (always null-filled). */
export interface StructuredProgress {
    current: number | null;
    total: number | null;
    percent: number | null;
    unit: string;
}
/**
 * Stage progress record produced by event normalizers / job progress fallbacks.
 * Consumed by public-stage-engine and stage progress collectors.
 */
export interface ProgressRecord {
    item?: unknown;
    payload?: JobLike | Record<string, unknown>;
    stageKey?: string;
    current?: number | null;
    total?: number | null;
    /** Alias used by presentation / view-model layers. */
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    displayPercent?: number | null;
    progressUnit?: string;
    /** Snake_case alias sometimes present on legacy payloads. */
    progress_unit?: string;
    sourceProgressUnit?: string;
    progressText?: string;
    visualStageKey?: string;
    substageKey?: string;
    indeterminate?: boolean;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    [key: string]: unknown;
}
/**
 * Snapshot-like input for stage progress view models
 * (presentation fields + status + stage progress map).
 */
export interface StageProgressViewSnapshot {
    stageKey?: string;
    status?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    displayPercent?: number | null;
    progressText?: string;
    progressUnit?: string;
    progressIndeterminate?: boolean;
    substageKey?: string;
    visualStageKey?: string;
    stageProgressByKey?: Record<string, ProgressRecord | null | undefined>;
    [key: string]: unknown;
}
/** Adapted snapshot returned by adaptJobStageSnapshot / adaptJobEventStageSnapshot. */
export interface AdaptedStageSnapshot extends StageSnapshot {
    jobId: string;
    status: string;
    publicStage: string;
    stageKey: string;
    substage: string;
    lane: string;
    progress: StructuredProgress | JobProgress;
    detail: string;
    source: string;
    terminal: boolean;
}
/** Raw stage event item from the events API. */
export interface StageEvent {
    seq?: number | string | null;
    ts?: string;
    created_at?: string;
    event?: string;
    event_type?: string;
    raw_event_type?: string;
    level?: string;
    message?: string;
    provider?: string;
    display_stage?: string;
    user_stage?: string;
    stage?: string;
    provider_stage?: string;
    substage?: string;
    lane?: string;
    stage_detail?: string;
    status?: string;
    progress?: JobProgress | null;
    progress_current?: number | null;
    progress_total?: number | null;
    progress_unit?: string;
    retry_count?: number | null;
    elapsed_ms?: number | null;
    payload?: Record<string, unknown> | null;
    [key: string]: unknown;
}
export interface EventsPayload {
    items?: StageEvent[];
    [key: string]: unknown;
}
/** Normalized event record from normalizedStageEventRecord. */
export interface StageEventRecord {
    item: StageEvent | Record<string, unknown>;
    lane: string;
    isMainLane: boolean;
    hasCanonicalEventContract: boolean;
    hasStructuredProgress: boolean;
    hasStructuredPublicStage: boolean;
    publicStage: string;
    canonicalDisplayStage: string;
    userStage: string;
    rawStage: string;
    substage: string;
    stageDetail: string;
    progress: {
        current: number | null;
        total: number | null;
        unit?: string;
        percent?: number | null;
    };
    progressPercent: number | null;
    progressUnit: string;
    seq: number | null;
    ts?: string | number | null;
    displayStage: string;
    progressText: string;
    stageText: string;
    timestamp?: string | number | null;
    [key: string]: unknown;
}
/** Presentation model from resolvePublicStagePresentation. */
export interface PublicStagePresentation {
    stageKey: string;
    stageKeyTrusted: boolean;
    visualStageKey: string;
    label: string;
    detail: string;
    progressText: string;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressPercent: number | null;
    displayPercent: number | null;
    progressUnit: string;
    substageKey: string;
    progressIndeterminate: boolean;
    terminal: boolean;
    backgroundStages?: BackgroundStageEntry[];
    stageProgressByKey?: Record<string, ProgressRecord | null>;
    [key: string]: unknown;
}
export interface BackgroundStageEntry {
    stageKey: string;
    substageKey: string;
    detail: string;
    progressText: string;
    progress: StructuredProgress | JobProgress | null | undefined;
    payload: JobLike | Record<string, unknown>;
}
export interface JobDisplayState {
    job: JobLike | JobPayload;
    events: EventsPayload;
    mainStageKey: string;
    mainSubstageKey: string;
    stagePresentation: PublicStagePresentation;
    stageProgressByKey: Record<string, ProgressRecord | null>;
    backgroundStages: BackgroundStageEntry[];
}
export interface EventIdentity {
    seq: number | null;
    ts: number | null;
}
/** Stage snapshot source tags used by trustedSnapshot / display-state. */
export type StageSnapshotSource = "public-stage" | "canonical-empty-stage" | "legacy-stage" | "event-contract" | "event-contract-empty-stage" | "event-legacy" | "display-state" | (string & {});
