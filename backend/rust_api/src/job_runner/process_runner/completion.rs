use std::path::Path;

use crate::models::{JobRuntimeState, JobStatusKind};

use crate::job_runner::{
    attach_job_provider_failure, clear_canceled_runtime_artifacts, clear_job_failure,
    refresh_job_failure, sync_runtime_state,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ProcessCompletionKind {
    Canceled,
    Succeeded,
    SucceededWithShutdownNoise,
    Failed,
}

pub(super) fn classify_process_completion(
    canceled: bool,
    process_success: bool,
    shutdown_noise_success: bool,
) -> ProcessCompletionKind {
    if canceled {
        ProcessCompletionKind::Canceled
    } else if process_success {
        ProcessCompletionKind::Succeeded
    } else if shutdown_noise_success {
        ProcessCompletionKind::SucceededWithShutdownNoise
    } else {
        ProcessCompletionKind::Failed
    }
}

pub(super) fn apply_process_completion(
    job: &mut JobRuntimeState,
    completion: ProcessCompletionKind,
    stderr_text: &str,
) {
    match completion {
        ProcessCompletionKind::Canceled => {
            job.status = JobStatusKind::Canceled;
            job.stage = Some("canceled".to_string());
            job.stage_detail = Some("任务已取消".to_string());
            clear_canceled_runtime_artifacts(job);
            clear_job_failure(job);
        }
        ProcessCompletionKind::Succeeded => {
            job.status = JobStatusKind::Succeeded;
            job.stage = Some("finished".to_string());
            job.stage_detail = Some("任务完成".to_string());
            clear_job_failure(job);
        }
        ProcessCompletionKind::SucceededWithShutdownNoise => {
            job.status = JobStatusKind::Succeeded;
            job.stage = Some("finished".to_string());
            job.stage_detail = Some("任务完成（已忽略 Python 退出阶段的收尾噪音）".to_string());
            job.error = None;
            clear_job_failure(job);
            job.append_log(
                "INFO: ignored Python shutdown noise after artifacts were already written successfully",
            );
        }
        ProcessCompletionKind::Failed => {
            attach_job_provider_failure(job, stderr_text);
            job.status = JobStatusKind::Failed;
            job.stage = Some("failed".to_string());
            if job
                .stage_detail
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .is_none()
            {
                job.stage_detail = Some("Python worker 执行失败".to_string());
            }
            job.error = Some(stderr_text.to_string());
            refresh_job_failure(job);
        }
    }
    sync_runtime_state(job);
}

pub(super) fn should_treat_shutdown_noise_as_success(
    job: &JobRuntimeState,
    stderr_text: &str,
) -> bool {
    let stderr = stderr_text.trim();
    if stderr.is_empty() || !is_shutdown_noise(stderr) {
        return false;
    }
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let render_outputs = artifacts.render_outputs();
    let translation_outputs = artifacts.translation_outputs();
    let output_pdf_ready = render_outputs
        .output_pdf
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    let translations_ready = translation_outputs
        .translations_dir
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    let summary_ready = render_outputs
        .summary
        .or(translation_outputs.summary)
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    match job.workflow {
        crate::models::WorkflowKind::Translate => translations_ready && summary_ready,
        _ => output_pdf_ready && summary_ready,
    }
}

pub(super) fn is_shutdown_noise(stderr: &str) -> bool {
    stderr.contains("Exception ignored in")
        || stderr.contains("sys.unraisablehook")
        || stderr.contains("Exception ignored in sys.unraisablehook")
}
