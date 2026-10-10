export type OcrAmbiguityResolutionKind = "bind_existing_receipt" | "accept_duplicate_risk";
export interface OcrAmbiguityResolutionRequest {
    resolution: OcrAmbiguityResolutionKind;
    resolution_revision: number;
    task_id?: string;
    batch_id?: string;
    upload_url?: string;
    trace_id?: string;
}
export interface OcrAmbiguityReceiptField {
    name: "task_id" | "batch_id" | "upload_url" | "trace_id";
    label: string;
    required: boolean;
    secret: boolean;
}
export interface OcrAmbiguityView {
    status: "ambiguous";
    provider: "paddle" | "mineru";
    operation: "submit_local_file" | "submit_remote_url" | "create_extract_task" | "apply_upload_url";
    resolution_revision: number;
    allowed_resolutions: OcrAmbiguityResolutionKind[];
    receipt_fields: OcrAmbiguityReceiptField[];
}
export interface JobDiagnosticsView {
    failure_code: string | null;
    ocr_ambiguity: OcrAmbiguityView | null;
    [key: string]: unknown;
}
export interface OcrAmbiguityResolutionView {
    resolution: OcrAmbiguityResolutionKind;
    provider: string;
    operation: string;
    submission: {
        job_id: string;
        source_job_id: string;
        status: string;
        workflow: string;
        rerun_from_stage: string;
        [key: string]: unknown;
    };
}
export type JobRetryStage = "ocr" | "translation" | "render" | "refine";
/** 上次精修的摘要（只在 stage=refine 上，没精修过时没有）。 */
export interface LastRefineView {
    /** completed / stopped / failed */
    status: string;
    generated_at: string;
    finding_count: number;
    applied: number;
    reviewed_item_count: number;
    candidate_item_count: number;
    unreviewed_item_count: number;
    /** 没审到的第一页（1-based）；全审到为 null。 */
    next_page: number | null;
    stopped_reason: string | null;
    /** review_only / review_and_fix / editorial；老后端没有。 */
    mode?: string;
    /** 编辑部留给人确认的块数。 */
    escalated_count?: number;
    /** 留给人确认的块（最多 50 条，按书中顺序）。 */
    escalated?: Array<{
        item_id: string;
        page_number: number;
        reason: string;
    }>;
}
export interface JobStageRetryActionView {
    stage: JobRetryStage;
    label: string;
    can_retry: boolean;
    reason?: string;
    disabled_reason?: string;
    will_reuse?: string[];
    will_rerun?: string[];
    danger?: boolean;
    last_refine?: LastRefineView;
    action?: {
        method?: string;
        url?: string;
        body?: Record<string, unknown>;
    } | null;
}
export interface JobStageActionsView {
    job_id: string;
    stages: JobStageRetryActionView[];
}
export declare function fetchJobDiagnostics(jobId: string, apiPrefix?: string): Promise<JobDiagnosticsView | null>;
export declare function fetchResumePlan(jobId: string, apiPrefix?: string): Promise<any>;
/** body 可带 `{ overrides: { translation: { api_key | credential_ref } } }`：续跑出来的新任务用这把 key。 */
export declare function resumeJob(jobId: string, apiPrefix?: string, body?: Record<string, unknown>): Promise<any>;
export declare function cancelJob(jobId: string, apiPrefix?: string): Promise<any>;
/** OCR 任务的取消和其它任务同一个地址（后端按任务类型分支）；保留这个名字给老调用方。 */
export declare function cancelOcrJob(jobId: string, apiPrefix?: string): Promise<any>;
export declare function resolveOcrAmbiguity(jobId: string, apiPrefix: string | undefined, request: OcrAmbiguityResolutionRequest): Promise<OcrAmbiguityResolutionView>;
export declare function fetchJobStageActions(jobId: string, apiPrefix?: string): Promise<JobStageActionsView | null>;
export declare function retryJobStage(jobId: string, apiPrefix: string | undefined, stage: string, payload?: Record<string, unknown>): Promise<any>;
/** body 同 resumeJob：可带 overrides.translation 换 key，不带时行为不变。 */
export declare function rerunJob(actionUrl: string, body?: Record<string, unknown>): Promise<any>;
