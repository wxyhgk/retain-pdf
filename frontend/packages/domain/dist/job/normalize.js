import { arrayOrEmpty, firstNonEmpty, isJobTerminal, numberOrNull, objectOrNull, unwrapEnvelope, } from "./core.js";
import { adaptJobStageSnapshot, } from "../job-status/job-stage-contract-adapter.js";
import { flattenStageSnapshot } from "./stage-snapshot-flatten.js";
function buildStageSnapshot(normalized = {}) {
    return adaptJobStageSnapshot(normalized);
}
export function normalizeJobPayload(payload = null) {
    const unwrapped = flattenStageSnapshot(unwrapEnvelope(payload) || {});
    const timestamps = (unwrapped.timestamps || {});
    const progress = (unwrapped.progress || {});
    const artifacts = (unwrapped.artifacts || {});
    const runtime = (unwrapped.runtime || {});
    const failure = unwrapped.failure || null;
    const invocation = (unwrapped.invocation || {});
    const status = unwrapped.status || "idle";
    let progressCurrent = numberOrNull(progress.current ?? unwrapped.progress_current);
    let progressTotal = numberOrNull(progress.total ?? unwrapped.progress_total);
    let progressPercent = numberOrNull(progress.percent);
    const terminal = isJobTerminal({
        ...unwrapped,
        status,
    });
    if (terminal) {
        if (progressTotal !== null) {
            progressCurrent = progressTotal;
        }
        if (progressCurrent !== null && progressTotal === null) {
            progressTotal = progressCurrent;
        }
        if (status === "succeeded") {
            progressPercent = 100;
        }
    }
    const requestPayload = (unwrapped.request_payload || null);
    // 书目 / 重试身份字段必须透传：silent 轮询与阶段重试靠 document_id / source_job_id
    // 把进度合并回主页原卡；丢了会「状态卡在跑、书架仍显示已翻译」。
    const documentId = firstNonEmpty(unwrapped.document_id, unwrapped.book_summary?.document_id);
    const jobId = firstNonEmpty(unwrapped.job_id);
    const title = firstNonEmpty(unwrapped.title, unwrapped.display_name);
    const normalized = {
        raw_response: unwrapped,
        request_payload: requestPayload,
        request_payload_page_ranges: firstNonEmpty(requestPayload?.ocr?.page_ranges),
        request_payload_math_mode: firstNonEmpty(requestPayload?.translation?.math_mode),
        job_id: jobId || "",
        // 图书馆卡片身份（重试换 job_id 时靠这些找原卡）
        document_id: documentId,
        source_job_id: firstNonEmpty(unwrapped.source_job_id),
        active_job_id: firstNonEmpty(unwrapped.active_job_id, jobId),
        library_only: Boolean(unwrapped.library_only),
        title,
        display_name: firstNonEmpty(unwrapped.display_name, title),
        source_file_name: firstNonEmpty(unwrapped.source_file_name),
        page_count: numberOrNull(unwrapped.page_count),
        cover_url: firstNonEmpty(unwrapped.cover_url),
        thumbnail_url: firstNonEmpty(unwrapped.thumbnail_url),
        workflow: unwrapped.workflow || unwrapped.job_type || "",
        job_type: unwrapped.job_type || unwrapped.workflow || "",
        status,
        display_stage: unwrapped.display_stage || "",
        user_stage: unwrapped.user_stage || "",
        stage: unwrapped.stage || "",
        substage: unwrapped.substage || "",
        lane: unwrapped.lane || "",
        stage_detail: unwrapped.stage_detail || "",
        progress: {
            current: progressCurrent,
            total: progressTotal,
            percent: progressPercent,
            unit: progress.unit || unwrapped.progress_unit || "",
        },
        progress_current: progressCurrent,
        progress_total: progressTotal,
        progress_percent: progressPercent,
        progress_unit: progress.unit || unwrapped.progress_unit || "",
        created_at: timestamps.created_at || unwrapped.created_at || "",
        updated_at: timestamps.updated_at || unwrapped.updated_at || "",
        started_at: timestamps.started_at || unwrapped.started_at || "",
        finished_at: timestamps.finished_at || unwrapped.finished_at || "",
        duration_seconds: numberOrNull(timestamps.duration_seconds ?? unwrapped.duration_seconds),
        links: (unwrapped.links || {}),
        actions: (unwrapped.actions || {}),
        artifacts,
        background_stages: arrayOrEmpty(unwrapped.background_stages),
        artifacts_display: arrayOrEmpty(unwrapped.artifacts_display),
        output_pdf_ready: Boolean(unwrapped.output_pdf_ready),
        source_pdf_ready: Boolean(unwrapped.source_pdf_ready),
        pdf_url: firstNonEmpty(unwrapped.pdf_url),
        pdf_path: firstNonEmpty(unwrapped.pdf_path),
        bundle_url: firstNonEmpty(unwrapped.bundle_url),
        bundle_path: firstNonEmpty(unwrapped.bundle_path),
        markdown_url: firstNonEmpty(unwrapped.markdown_url),
        markdown_path: firstNonEmpty(unwrapped.markdown_path),
        source_pdf_url: firstNonEmpty(unwrapped.source_pdf_url),
        source_pdf_path: firstNonEmpty(unwrapped.source_pdf_path),
        ocr_job: objectOrNull(unwrapped.ocr_job),
        runtime,
        invocation,
        failure,
        normalization_summary: objectOrNull(unwrapped.normalization_summary),
        glossary_summary: objectOrNull(unwrapped.glossary_summary),
        current_stage: firstNonEmpty(unwrapped.display_stage, unwrapped.user_stage, runtime.current_stage, unwrapped.stage),
        stage_started_at: firstNonEmpty(runtime.stage_started_at),
        last_stage_transition_at: firstNonEmpty(runtime.last_stage_transition_at),
        active_stage_elapsed_ms: numberOrNull(runtime.active_stage_elapsed_ms),
        total_elapsed_ms: numberOrNull(runtime.total_elapsed_ms),
        retry_count: numberOrNull(runtime.retry_count) ?? 0,
        last_retry_at: firstNonEmpty(runtime.last_retry_at),
        stage_history: arrayOrEmpty(runtime.stage_history),
        terminal_reason: firstNonEmpty(runtime.terminal_reason),
        final_failure_category: firstNonEmpty(runtime.final_failure_category),
        final_failure_summary: firstNonEmpty(runtime.final_failure_summary),
        failure_diagnostic: unwrapped.failure_diagnostic || null,
        log_tail: Array.isArray(unwrapped.log_tail) ? unwrapped.log_tail : [],
        error: unwrapped.error || "",
        pdf_ready: Boolean(unwrapped.output_pdf_ready ?? artifacts.pdf_ready ?? artifacts.pdf?.ready),
        markdown_ready: Boolean(unwrapped.markdown_ready ?? artifacts.markdown_ready ?? artifacts.markdown?.ready),
        bundle_ready: Boolean(unwrapped.bundle_ready ?? artifacts.bundle_ready ?? artifacts.bundle?.ready),
    };
    return {
        ...normalized,
        stage_snapshot: buildStageSnapshot(normalized),
    };
}
