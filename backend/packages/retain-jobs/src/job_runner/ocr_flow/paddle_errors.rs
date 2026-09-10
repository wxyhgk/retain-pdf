use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut};
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::paddle::PaddleProviderError;
use crate::ocr_provider::{OcrErrorCategory, OcrProviderErrorInfo};

pub(super) fn attach_paddle_runtime_error(
    job: &mut JobRuntimeState,
    err: anyhow::Error,
    stage: &str,
) -> anyhow::Error {
    if let Some(provider_err) = err.downcast_ref::<PaddleProviderError>() {
        apply_paddle_error(
            job,
            provider_err.info().clone(),
            provider_err.stage_detail(),
        );
        return err;
    }
    let info = OcrProviderErrorInfo {
        category: match stage {
            "download" => OcrErrorCategory::ResultDownloadFailed,
            "poll" => OcrErrorCategory::ProviderFailed,
            _ => OcrErrorCategory::Unknown,
        },
        provider_code: None,
        provider_message: Some(err.to_string()),
        operator_hint: Some("请结合 job 日志和 Paddle 任务状态继续排查".to_string()),
        trace_id: job_artifacts_mut(job).provider_trace_id.clone(),
        http_status: None,
    };
    apply_paddle_error(job, info, format!("Paddle {stage} 失败: {}", err));
    err
}

fn apply_paddle_error(job: &mut JobRuntimeState, info: OcrProviderErrorInfo, stage_detail: String) {
    if let Some(trace_id) = info.trace_id.clone() {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
    ocr_provider_diagnostics_mut(job).last_error = Some(info);
    if !stage_detail.trim().is_empty() {
        job.stage_detail = Some(stage_detail);
    }
}
