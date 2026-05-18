use anyhow::Result;

use crate::models::{now_iso, JobRuntimeState};
use crate::ocr_provider::OcrTaskStatus;

use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut, ProcessRuntimeDeps};

use super::save_ocr_job;

pub(super) async fn update_ocr_job_from_status(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    status: OcrTaskStatus,
    current: Option<i64>,
    total: Option<i64>,
    parent_job_id: Option<&str>,
) -> Result<()> {
    ocr_provider_diagnostics_mut(job).last_status = Some(status.clone());
    if let Some(stage) = status.stage.clone() {
        job.stage = Some(stage);
    }
    job.stage_detail = ocr_stage_detail_with_progress(
        status.detail.clone().or(status.provider_message.clone()),
        current,
        total,
    );
    job.progress_current = current;
    job.progress_total = total;
    record_provider_trace(job, status.trace_id.clone());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;
    Ok(())
}

fn ocr_stage_detail_with_progress(
    fallback: Option<String>,
    current: Option<i64>,
    total: Option<i64>,
) -> Option<String> {
    match (current, total) {
        (Some(current), Some(total)) if total > 0 => Some(format!(
            "Paddle 正在解析文件，第 {}/{} 页",
            current.max(0),
            total
        )),
        (None, Some(total)) if total > 0 => Some(format!("OCR 正在解析，共 {} 页", total)),
        _ => fallback,
    }
}

pub(super) fn record_provider_trace(job: &mut JobRuntimeState, trace_id: Option<String>) {
    if let Some(trace_id) = trace_id.filter(|item| !item.trim().is_empty()) {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
}

#[cfg(test)]
mod tests {
    use super::ocr_stage_detail_with_progress;

    #[test]
    fn ocr_stage_detail_prefers_page_progress_when_available() {
        assert_eq!(
            ocr_stage_detail_with_progress(
                Some("Paddle 正在解析文件".to_string()),
                Some(12),
                Some(34)
            )
            .as_deref(),
            Some("Paddle 正在解析文件，第 12/34 页")
        );
        assert_eq!(
            ocr_stage_detail_with_progress(None, None, Some(34)).as_deref(),
            Some("OCR 正在解析，共 34 页")
        );
    }
}
