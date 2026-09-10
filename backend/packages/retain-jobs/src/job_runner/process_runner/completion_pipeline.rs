use anyhow::Result;

use crate::config::WorkerProcessRuntimeConfig;
use crate::job_runner::cancel_registry::is_cancel_requested_any;
use crate::job_runner::process_contract::validate_successful_worker_outputs;
use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::JobRuntimeState;

use super::completion::{
    apply_process_completion, classify_process_completion, should_treat_shutdown_noise_as_success,
    ProcessCompletionKind,
};
use super::execution::CompletedProcess;
use super::failure_ai_diagnosis::maybe_attach_ai_failure_diagnosis;
use super::result_support::attach_process_result;

pub(super) async fn finalize_completed_process(
    deps: &ProcessRuntimeDeps,
    worker_runtime: &WorkerProcessRuntimeConfig<'_>,
    completed: CompletedProcess,
    extra_cancel_job_ids: &[String],
) -> Result<JobRuntimeState> {
    let mut latest_job = completed.latest_job;
    attach_process_result(
        &mut latest_job,
        &completed.status,
        completed.started,
        completed.stdout_text,
        &completed.stderr_text,
        worker_runtime.project_root,
    );

    let mut completion = classify_process_completion(
        is_cancel_requested_any(
            &deps.canceled_jobs,
            &latest_job.job_id,
            extra_cancel_job_ids,
        )
        .await,
        completed.status.success(),
        should_treat_shutdown_noise_as_success(&latest_job, &completed.stderr_text),
    );
    if matches!(
        completion,
        ProcessCompletionKind::Succeeded | ProcessCompletionKind::SucceededWithShutdownNoise
    ) {
        ensure_successful_worker_contract(
            &mut latest_job,
            &deps.persist.data_root,
            &mut completion,
        );
    }
    apply_process_completion(&mut latest_job, completion, &completed.stderr_text);
    if matches!(
        completion,
        ProcessCompletionKind::Succeeded | ProcessCompletionKind::SucceededWithShutdownNoise
    ) {
        attach_untranslated_content_warning(&mut latest_job, &deps.persist.data_root);
    }
    maybe_attach_ai_failure_diagnosis(
        deps.db.as_ref(),
        &deps.failure_ai_diagnosis_runtime(),
        &mut latest_job,
    )
    .await;
    Ok(latest_job)
}

/// If the translation diagnostics report blocks kept in source language
/// (e.g. upstream 402/429/timeout later recorded as keep-origin), keep the
/// job successful but say so in `stage_detail` instead of "任务完成".
/// Without this, users see a green success with English leftovers and file
/// it as a rendering bug.
fn attach_untranslated_content_warning(job: &mut JobRuntimeState, data_root: &std::path::Path) {
    let path = data_root
        .join("jobs")
        .join(&job.job_id)
        .join("artifacts")
        .join("translation_diagnostics.json");
    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(_) => return,
    };
    let value: serde_json::Value = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(_) => return,
    };
    let kept = value
        .get("status_summary")
        .and_then(|summary| summary.get("kept_origin"))
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    let dead = value
        .get("dead_letter_count")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(0);
    let count = kept.max(dead);
    if count == 0 {
        return;
    }
    job.stage_detail = Some(format!(
        "任务完成，但有 {count} 个内容块保留原文未翻译（多为余额不足、上游限流或超时），充值或稍后重试可补翻"
    ));
    job.append_log(&format!(
        "WARN: {count} block(s) kept in source language (see translation_diagnostics.json); job stays succeeded with a partial-translation warning"
    ));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{CreateJobInput, JobSnapshot};

    fn write_diagnostics(data_root: &std::path::Path, job_id: &str, body: &str) {
        let dir = data_root.join("jobs").join(job_id).join("artifacts");
        std::fs::create_dir_all(&dir).expect("diagnostics dir");
        std::fs::write(dir.join("translation_diagnostics.json"), body).expect("diagnostics file");
    }

    fn warning_job(job_id: &str) -> JobRuntimeState {
        let mut job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime();
        job.stage_detail = Some("任务完成".to_string());
        job
    }

    #[test]
    fn kept_origin_blocks_amend_stage_detail() {
        let root = std::env::temp_dir().join(format!(
            "rust-api-dead-letter-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        write_diagnostics(
            &data_root,
            "job-1",
            r#"{"status_summary": {"translated": 121, "kept_origin": 18}, "dead_letter_count": 18}"#,
        );
        let mut job = warning_job("job-1");
        attach_untranslated_content_warning(&mut job, &data_root);
        let detail = job.stage_detail.clone().unwrap_or_default();
        assert!(detail.contains("18"), "detail: {detail}");
        assert!(detail.contains("保留原文未翻译"), "detail: {detail}");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn clean_translation_leaves_stage_detail_untouched() {
        let root = std::env::temp_dir().join(format!(
            "rust-api-dead-letter-clean-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        write_diagnostics(
            &data_root,
            "job-1",
            r#"{"status_summary": {"translated": 139, "kept_origin": 0}, "dead_letter_count": 0}"#,
        );
        let mut job = warning_job("job-1");
        attach_untranslated_content_warning(&mut job, &data_root);
        assert_eq!(job.stage_detail.as_deref(), Some("任务完成"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_diagnostics_file_is_silent() {
        let root = std::env::temp_dir().join(format!(
            "rust-api-dead-letter-missing-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        let mut job = warning_job("job-1");
        attach_untranslated_content_warning(&mut job, &root.join("data"));
        assert_eq!(job.stage_detail.as_deref(), Some("任务完成"));
        let _ = std::fs::remove_dir_all(&root);
    }
}

fn ensure_successful_worker_contract(
    latest_job: &mut JobRuntimeState,
    data_root: &std::path::Path,
    completion: &mut ProcessCompletionKind,
) {
    if let Err(err) = validate_successful_worker_outputs(latest_job, data_root) {
        latest_job.append_log(&format!("ERROR: worker output contract failed: {err}"));
        latest_job.stage_detail = Some(format!("Python worker 成功退出，但必需产物缺失：{err}"));
        *completion = ProcessCompletionKind::Failed;
    }
}
