/**
 * Shared types for the job core model (normalize / terminal / artifacts).
 * Inferred from normalize.ts, mock job payloads, and status-card consumers.
 *
 * Source of truth: `contracts/job-status.v1.schema.json` (JobDetailView / JobListView / JobProgressView / JobStageSnapshotView)
 * and `contracts/library-books.v1.schema.json` (JobListItemView cover/progress fields).
 * These hand-written types are a mirror of the Rust views in
 * `backend/packages/retain-core/src/models/view/job_types.rs` + `common.rs`.
 * Contract tests `tests/job-status-contract.test.mjs` + `tests/library-books-contract.test.mjs`
 * lock `job_id/display_name/workflow/status/stage_snapshot/progress/cover_url`等关键字段。
 * TODO: generate from schemas (json-schema-to-typescript) and re-export here.
 */
/** Job lifecycle status values used by the frontend. */
export type JobStatus = "idle" | "queued" | "running" | "succeeded" | "failed" | "canceled" | "cancelled" | (string & {});
/** Public display stages shown to the user. */
export type PublicStage = "ocr" | "translation" | "render" | "done" | (string & {});
/** Internal stage keys (translate maps from public "translation"). */
export type StageKey = "ocr" | "translate" | "render" | "done" | "queued" | "running" | "failed" | "canceled" | "idle" | (string & {});
export type JobLane = "main" | "background" | (string & {});
export type ProgressUnit = "page" | "batch" | "step" | "percent" | "none" | "" | (string & {});
/** Structured progress object on job payloads and stage snapshots. */
export interface JobProgress {
    current?: number | null;
    total?: number | null;
    percent?: number | null;
    unit?: ProgressUnit | string;
}
export interface JobTimestamps {
    created_at?: string;
    updated_at?: string;
    started_at?: string;
    finished_at?: string;
    duration_seconds?: number | null;
}
export interface JobRuntime {
    current_stage?: string;
    stage_started_at?: string;
    last_stage_transition_at?: string;
    active_stage_elapsed_ms?: number | null;
    total_elapsed_ms?: number | null;
    retry_count?: number | null;
    last_retry_at?: string;
    stage_history?: StageHistoryEntry[];
    terminal_reason?: string;
    final_failure_category?: string;
    final_failure_summary?: string;
    [key: string]: unknown;
}
export interface StageHistoryEntry {
    stage?: string;
    detail?: string;
    display_stage?: string;
    user_stage?: string;
    public_stage?: string;
    stage_detail?: string;
    enter_at?: string;
    exit_at?: string;
    duration_ms?: number | null;
    terminal_status?: string;
    [key: string]: unknown;
}
/** Options for live duration / stage-history elapsed resolution. */
export interface JobDurationOptions {
    finishedAtFallback?: string;
    now?: string | Date | null;
}
/** Nested request payload fields used by normalize / artifact naming. */
export interface JobRequestPayload {
    source?: {
        upload_id?: string;
        [key: string]: unknown;
    };
    ocr?: {
        provider?: string;
        page_ranges?: string;
        [key: string]: unknown;
    };
    translation?: {
        mode?: string;
        math_mode?: string;
        [key: string]: unknown;
    };
    render?: {
        render_mode?: string;
        [key: string]: unknown;
    };
    filename?: string;
    file_name?: string;
    original_filename?: string;
    original_file_name?: string;
    source_filename?: string;
    source_file_name?: string;
    [key: string]: unknown;
}
export interface BookSummary {
    source_file_name?: string;
    title?: string;
    [key: string]: unknown;
}
export interface JobAction {
    enabled?: boolean;
    method?: string;
    url?: string;
    path?: string;
    [key: string]: unknown;
}
export interface JobArtifactResource {
    ready?: boolean;
    json_url?: string;
    json_path?: string;
    raw_url?: string;
    raw_path?: string;
    images_base_url?: string;
    images_base_path?: string;
    file_name?: string;
    size_bytes?: number | null;
    [key: string]: unknown;
}
export interface JobArtifacts {
    pdf_ready?: boolean;
    markdown_ready?: boolean;
    bundle_ready?: boolean;
    output_pdf_ready?: boolean;
    translated_pdf_ready?: boolean;
    markdown_images_base_url?: string;
    pdf?: {
        ready?: boolean;
        [key: string]: unknown;
    };
    markdown?: JobArtifactResource;
    bundle?: {
        ready?: boolean;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export interface ArtifactDisplayItem {
    key?: string;
    kind?: string;
    ready?: boolean;
    [key: string]: unknown;
}
export interface JobFailure {
    summary?: string;
    category?: string;
    stage?: string;
    root_cause?: string;
    suggestion?: string;
    retryable?: boolean;
    [key: string]: unknown;
}
export interface ManifestArtifactItem {
    artifact_key?: string;
    ready?: boolean;
    resource_url?: string;
    resource_path?: string;
    filename?: string;
    file_name?: string;
    name?: string;
    [key: string]: unknown;
}
export interface ManifestPayload {
    items?: ManifestArtifactItem[];
    [key: string]: unknown;
}
export interface MarkdownContract {
    ready: boolean;
    jsonUrl: string;
    rawUrl: string;
    imagesBaseUrl: string;
    fileName: string;
    sizeBytes: number | null;
}
/**
 * Backend-shaped stage_snapshot before frontend adaptation
 * (flat fields inside stage_snapshot on the wire).
 */
export interface BackendStageSnapshot {
    display_stage?: string;
    stage?: string;
    substage?: string;
    lane?: string;
    stage_detail?: string;
    progress?: JobProgress | null;
    stage_history?: StageHistoryEntry[];
    [key: string]: unknown;
}
/**
 * Frontend-adapted stage snapshot produced by adaptJobStageSnapshot /
 * normalizeJobPayload.stage_snapshot.
 */
export interface StageSnapshot {
    jobId?: string;
    status?: string;
    publicStage?: string;
    /** Snake_case alias sometimes present on trusted snapshots. */
    public_stage?: string;
    stageKey?: string;
    substage?: string;
    lane?: string;
    progress?: JobProgress | null;
    detail?: string;
    source?: string;
    terminal?: boolean;
    display_stage?: string;
    stage?: string;
    stage_detail?: string;
    stage_history?: StageHistoryEntry[];
    [key: string]: unknown;
}
/** API envelope: `{ code, message?, data }`. */
export interface ApiEnvelope<T = unknown> {
    code: number;
    message?: string;
    data?: T;
}
/**
 * Loose job-shaped input accepted by core helpers (raw API, mock, partial).
 * Prefer {@link JobPayload} for the normalized shape.
 */
export interface JobLike {
    job_id?: string;
    id?: string;
    status?: JobStatus | string;
    workflow?: string;
    job_type?: string;
    display_stage?: string;
    user_stage?: string;
    stage?: string;
    substage?: string;
    lane?: string;
    stage_detail?: string;
    progress?: JobProgress | null;
    progress_current?: number | null;
    progress_total?: number | null;
    progress_percent?: number | null;
    progress_unit?: string;
    stage_snapshot?: StageSnapshot | BackendStageSnapshot | null;
    background_stages?: unknown[];
    background_snapshots?: unknown[];
    artifacts?: JobArtifacts | Record<string, unknown> | null;
    artifacts_display?: ArtifactDisplayItem[];
    output_pdf_ready?: boolean;
    source_pdf_ready?: boolean;
    pdf_ready?: boolean;
    markdown_ready?: boolean;
    bundle_ready?: boolean;
    translated_pdf_ready?: boolean;
    pdf_url?: string;
    pdf_path?: string;
    bundle_url?: string;
    bundle_path?: string;
    markdown_url?: string;
    markdown_path?: string;
    source_pdf_url?: string;
    source_pdf_path?: string;
    terminal_reason?: string;
    runtime?: JobRuntime | Record<string, unknown> | null;
    timestamps?: JobTimestamps | Record<string, unknown> | null;
    actions?: Record<string, JobAction | unknown> | null;
    links?: Record<string, unknown> | null;
    failure?: JobFailure | null;
    failure_diagnostic?: unknown;
    request_payload?: JobRequestPayload | Record<string, unknown> | null;
    raw_response?: JobLike | Record<string, unknown> | null;
    invocation?: Record<string, unknown> | null;
    ocr_job?: Record<string, unknown> | null;
    normalization_summary?: Record<string, unknown> | null;
    glossary_summary?: Record<string, unknown> | null;
    log_tail?: unknown[];
    error?: string;
    created_at?: string;
    updated_at?: string;
    started_at?: string;
    finished_at?: string;
    duration_seconds?: number | null;
    current_stage?: string;
    stage_started_at?: string;
    last_stage_transition_at?: string;
    active_stage_elapsed_ms?: number | null;
    total_elapsed_ms?: number | null;
    retry_count?: number | null;
    last_retry_at?: string;
    stage_history?: StageHistoryEntry[];
    final_failure_category?: string;
    final_failure_summary?: string;
    filename?: string;
    file_name?: string;
    source_file_name?: string;
    display_name?: string;
    original_filename?: string;
    original_file_name?: string;
    book_summary?: BookSummary | Record<string, unknown>;
    payload?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Normalized job payload returned by {@link normalizeJobPayload}.
 * Includes legacy flat fields plus adapted `stage_snapshot`.
 */
export interface JobPayload extends JobLike {
    raw_response: JobLike | Record<string, unknown>;
    job_id: string;
    status: JobStatus | string;
    progress: JobProgress;
    progress_current: number | null;
    progress_total: number | null;
    progress_percent: number | null;
    progress_unit: string;
    stage_snapshot: StageSnapshot;
    background_stages: unknown[];
    artifacts: JobArtifacts | Record<string, unknown>;
    artifacts_display: ArtifactDisplayItem[];
    output_pdf_ready: boolean;
    source_pdf_ready: boolean;
    pdf_ready: boolean;
    markdown_ready: boolean;
    bundle_ready: boolean;
    runtime: JobRuntime | Record<string, unknown>;
    invocation: Record<string, unknown>;
    retry_count: number;
    log_tail: unknown[];
    error: string;
    created_at: string;
    updated_at: string;
    started_at: string;
    finished_at: string;
    duration_seconds: number | null;
    links: Record<string, unknown>;
    actions: Record<string, JobAction | unknown>;
    display_stage: string;
    user_stage: string;
    stage: string;
    substage: string;
    lane: string;
    stage_detail: string;
    current_stage: string;
    stage_started_at: string;
    last_stage_transition_at: string;
    active_stage_elapsed_ms: number | null;
    total_elapsed_ms: number | null;
    last_retry_at: string;
    stage_history: StageHistoryEntry[];
    terminal_reason: string;
    final_failure_category: string;
    final_failure_summary: string;
    pdf_url: string;
    pdf_path: string;
    bundle_url: string;
    bundle_path: string;
    markdown_url: string;
    markdown_path: string;
    source_pdf_url: string;
    source_pdf_path: string;
    request_payload_page_ranges: string;
    request_payload_math_mode: string;
    workflow: string;
    job_type: string;
}
/** Input accepted by normalize / unwrap helpers. */
export type JobPayloadInput = JobLike | ApiEnvelope<JobLike> | null | undefined;
export interface ArtifactUrlQuery {
    [key: string]: string | number | boolean | null | undefined;
}
export interface ArtifactUrlResolveOptions {
    query?: ArtifactUrlQuery | null;
    resolver?: {
        resolve?: (value: unknown, options?: ArtifactUrlResolveOptions) => string;
    };
    [key: string]: unknown;
}
export interface ArtifactRuntimeState {
    currentJobId?: string;
    currentJobSnapshot?: JobLike | JobPayload | null;
    currentJobManifest?: ManifestPayload | null;
    currentJobManifestJobId?: string;
    uploadId?: string;
    uploadedFileName?: string;
    uploadedPageCount?: number;
    uploadedBytes?: number;
    appliedPageRange?: string;
    submitBusy?: boolean;
    [key: string]: unknown;
}
export interface UploadSnapshot {
    uploadId?: string;
    uploadedFileName?: string;
    uploadedPageCount?: number;
    uploadedBytes?: number;
    appliedPageRange?: string;
    submitBusy?: boolean;
    [key: string]: unknown;
}
export interface ArtifactRuntimePortDeps {
    getCurrentJobId?: (state?: ArtifactRuntimeState | null) => string;
    getCurrentJobSnapshot?: (state?: ArtifactRuntimeState | null) => JobLike | JobPayload | null;
    getCachedManifestFor?: (state: ArtifactRuntimeState | null | undefined, jobId: string) => ManifestPayload | null;
    getUploadSnapshot?: (state?: ArtifactRuntimeState | null) => UploadSnapshot;
}
export interface ArtifactUrlConfigPortDeps {
    resolveApiBase?: () => string;
}
