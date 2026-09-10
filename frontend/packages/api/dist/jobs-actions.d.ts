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
export type JobRetryStage = "ocr" | "translation" | "render";
export interface JobStageRetryActionView {
    stage: JobRetryStage;
    label: string;
    can_retry: boolean;
    reason?: string;
    disabled_reason?: string;
    will_reuse?: string[];
    will_rerun?: string[];
    danger?: boolean;
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
export declare function resumeJob(jobId: string, apiPrefix?: string): Promise<any>;
export declare function cancelJob(jobId: string, apiPrefix?: string): Promise<any>;
export declare function cancelOcrJob(jobId: string, apiPrefix?: string): Promise<any>;
export declare function resolveOcrAmbiguity(jobId: string, apiPrefix: string | undefined, request: OcrAmbiguityResolutionRequest): Promise<OcrAmbiguityResolutionView>;
export declare function fetchJobStageActions(jobId: string, apiPrefix?: string): Promise<JobStageActionsView | null>;
export declare function retryJobStage(jobId: string, apiPrefix: string | undefined, stage: string, payload?: Record<string, unknown>): Promise<any>;
export declare function rerunJob(actionUrl: string): Promise<any>;
