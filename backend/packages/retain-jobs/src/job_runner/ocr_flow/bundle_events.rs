use crate::job_events::record_custom_runtime_event_with_resources;
use crate::job_runner::{register_job_retry, ProcessRuntimeDeps};
use crate::models::domain::{now_iso, JobRuntimeState};

pub(super) struct BundleRetryEvent<'a> {
    pub(super) scope: &'a str,
    pub(super) attempt: usize,
    pub(super) max_attempts: usize,
    pub(super) delay_secs: Option<u64>,
    pub(super) elapsed_secs: Option<u64>,
    pub(super) timeout_secs: Option<u64>,
    pub(super) reason: String,
    pub(super) url: &'a str,
}

pub(super) fn mark_ocr_result_ready(job: &mut JobRuntimeState, stage_detail: String) {
    job.stage = Some("ocr_result_ready".to_string());
    job.stage_detail = Some(stage_detail);
    job.updated_at = now_iso();
}

pub(super) fn record_bundle_retry_scheduled(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    stage_detail: String,
    message: &str,
    event: BundleRetryEvent<'_>,
) {
    mark_ocr_result_ready(job, stage_detail);
    register_job_retry(job);
    let mut payload = bundle_retry_payload(&event);
    if let Some(delay_secs) = event.delay_secs {
        payload["delay_seconds"] = serde_json::json!(delay_secs);
    }
    record_custom_runtime_event_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job.snapshot(),
        "warn",
        "retry_scheduled",
        message,
        Some(payload),
    );
}

pub(super) fn record_bundle_retry_degraded(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    event: BundleRetryEvent<'_>,
) {
    mark_ocr_result_ready(
        job,
        "OCR provider bundle 探测连续异常，改为直接下载并按下载重试策略兜底".to_string(),
    );
    register_job_retry(job);
    let mut payload = bundle_retry_payload(&event);
    if let Some(elapsed_secs) = event.elapsed_secs {
        payload["elapsed_seconds"] = serde_json::json!(elapsed_secs);
    }
    if let Some(timeout_secs) = event.timeout_secs {
        payload["timeout_seconds"] = serde_json::json!(timeout_secs);
    }
    payload["fallback"] = serde_json::json!("direct_download");
    record_custom_runtime_event_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job.snapshot(),
        "warn",
        "retry_degraded",
        "OCR provider bundle 可达性探测降级为直接下载",
        Some(payload),
    );
}

fn bundle_retry_payload(event: &BundleRetryEvent<'_>) -> serde_json::Value {
    serde_json::json!({
        "scope": event.scope,
        "attempt": event.attempt,
        "max_attempts": event.max_attempts,
        "reason": event.reason,
        "url": event.url,
    })
}
