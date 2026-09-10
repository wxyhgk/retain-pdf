use crate::error::AppError;
use crate::models::api::JobSubmissionView;
use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::models::request::{CreateJobInput, JobSourceInput};
use crate::services::jobs::stage_plan::resume_plan;
use crate::services::jobs::translation_request_recovery::load_translation_request_recovery;
use crate::services::managed_credential_gc::cleanup_deleted_job_credentials;

use super::super::super::creation::create_translation_job;
use super::super::super::query::load_job_or_404;
use super::super::JobsFacade;
use super::ocr_ambiguity::ambiguous_ocr_dispatch;
use super::stage_retry_overrides::{
    discard_ocr_secret_sources, discard_translation_secret_sources,
};
use crate::services::job_launcher::start_job_execution;

impl<'a> JobsFacade<'a> {
    pub fn rerun_submission(
        &self,
        base_url: &str,
        source_job_id: &str,
    ) -> Result<JobSubmissionView, AppError> {
        let source_job = load_job_or_404(self.command.db, source_job_id)?;
        let plan = resume_plan(&source_job, self.command.control.data_root);
        if plan.resume_workflow == Some(WorkflowKind::Render) {
            let job_id = source_job.job_id.clone();
            let ocr_child_id = format!("{}-ocr", job_id);
            // Clean up any previous OCR child that is now orphaned due to in-place rerender
            let deleted_ocr_child = self.command.db.get_job(&ocr_child_id).ok();
            let _ = self.command.db.delete_job(&ocr_child_id);
            if let Some(deleted_ocr_child) = deleted_ocr_child {
                cleanup_deleted_job_credentials(
                    self.command.db,
                    self.command.control.data_root,
                    &[deleted_ocr_child],
                );
            }
            let ocr_child_dir = self
                .command
                .control
                .data_root
                .join("jobs")
                .join(&ocr_child_id);
            let _ = std::fs::remove_dir_all(&ocr_child_dir);
            // Also clear any stale rendered output on disk that would otherwise make
            // completion's Path::exists() treat old PDF as success
            let rendered_dir = self
                .command
                .control
                .output_root
                .join(&job_id)
                .join("rendered");
            let _ = std::fs::remove_dir_all(&rendered_dir);
            let job = prepare_in_place_render_job(source_job)?;
            let job = start_job_execution(&self.command.submit.launcher, job)?;
            return Ok(self.build_submission_view(
                base_url,
                &job,
                JobStatusKind::Queued,
                WorkflowKind::Render,
            ));
        }
        if source_job
            .request_payload
            .translation
            .execution_connection
            .is_some()
        {
            return Err(AppError::conflict("Rust model translation rerun requires receipt-preserving recovery; legacy rerun is disabled"));
        }
        if ambiguous_ocr_dispatch(self.command.db, source_job_id)?.is_some() {
            return Err(AppError::conflict(
                "OCR request outcome is ambiguous; generic rerun is paused. Use the OCR ambiguity resolution endpoint to bind an existing provider task or explicitly accept duplicate request risk",
            ));
        }
        if load_translation_request_recovery(&source_job, self.command.control.data_root)
            .is_some_and(|state| state.requires_confirmation)
        {
            return Err(AppError::conflict(
                "translation request outcome is ambiguous; generic rerun is paused. Use retry-stage with stage=translation and ambiguous_request_policy=accept_duplicate_risk",
            ));
        }
        let request = build_rerun_request(&source_job, self.command.control.data_root)?;
        let workflow = request.workflow.clone();
        let job = create_translation_job(&self.command.submit, &request)?;
        // 重跑即链文档（同 retry）：新任务无 upload_id，走源任务反查文档。
        match self.command.db.get_document_by_job_id(source_job_id) {
            Ok(Some(doc)) => {
                if let Err(error) =
                    self.command
                        .db
                        .set_document_active_job(&doc.document_id, &job.job_id, None)
                {
                    tracing::warn!(
                        "library: set active job for {} at rerun failed: {error}",
                        doc.document_id
                    );
                }
            }
            Ok(None) => {}
            Err(error) => {
                tracing::warn!(
                    "library: resolve document for rerun source {source_job_id} failed: {error}"
                );
            }
        }
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, workflow))
    }
}

pub(super) fn prepare_in_place_render_job(mut job: JobSnapshot) -> Result<JobSnapshot, AppError> {
    if matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(
            "job is already queued or running; cancel it before rerender",
        ));
    }

    let now = now_iso();
    job.workflow = WorkflowKind::Render;
    job.request_payload.workflow = WorkflowKind::Render;
    job.request_payload.source.upload_id.clear();
    job.request_payload.source.source_url.clear();
    job.request_payload.source.artifact_job_id = job.job_id.clone();
    // Render never contacts OCR or translation providers. Rewriting the same
    // durable job must not retain historical inline secrets or vault refs.
    discard_ocr_secret_sources(&mut job.request_payload.ocr);
    discard_translation_secret_sources(&mut job.request_payload.translation);
    job.request_payload.runtime.job_id = job.job_id.clone();
    job.status = JobStatusKind::Queued;
    job.updated_at = now;
    job.started_at = None;
    job.finished_at = None;
    job.pid = None;
    job.command.clear();
    job.error = None;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("重渲染任务排队中，等待可用执行槽位".to_string());
    job.progress_current = Some(0);
    job.progress_total = None;
    job.log_tail.clear();
    job.result = None;
    job.runtime = None;
    job.replace_failure_info(None);
    reset_render_artifacts(&mut job);
    // Also clear stale OCR child linkage that would otherwise point to a now-orphaned *-ocr job
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.ocr_job_id = None;
        artifacts.ocr_status = None;
        artifacts.ocr_trace_id = None;
        artifacts.ocr_provider_trace_id = None;
    }
    job.sync_runtime_state();
    Ok(job)
}

fn reset_render_artifacts(job: &mut JobSnapshot) {
    let Some(artifacts) = job.artifacts.as_mut() else {
        return;
    };
    artifacts.output_pdf = None;
    artifacts.summary = None;
    artifacts.events_jsonl = None;
    artifacts.pages_processed = None;
    artifacts.translate_render_time_seconds = None;
    artifacts.save_time_seconds = None;
    artifacts.total_time_seconds = None;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_place_render_drops_unused_provider_credentials() {
        let mut input = CreateJobInput::default();
        input.ocr.credential_ref = "cred_ocr_old".to_string();
        input.ocr.mineru_token = "mineru-old".to_string();
        input.ocr.options.insert(
            "credential".to_string(),
            serde_json::Value::String("configured-old".to_string()),
        );
        input.translation.credential_ref = "cred_translation_old".to_string();
        input.translation.api_key = "translation-old".to_string();
        let mut job = JobSnapshot::new("job-render-retry".to_string(), input, Vec::new());
        job.status = JobStatusKind::Failed;

        let job = prepare_in_place_render_job(job).expect("prepare in-place render");

        assert!(job.request_payload.ocr.credential_ref.is_empty());
        assert!(job.request_payload.ocr.mineru_token.is_empty());
        assert!(!job.request_payload.ocr.options.contains_key("credential"));
        assert!(job.request_payload.translation.credential_ref.is_empty());
        assert!(job.request_payload.translation.api_key.is_empty());
    }
}

fn build_rerun_request(
    source_job: &JobSnapshot,
    data_root: &std::path::Path,
) -> Result<CreateJobInput, AppError> {
    let plan = resume_plan(source_job, data_root);
    let workflow = plan.resume_workflow.ok_or_else(|| {
        AppError::bad_request(
            plan.reason
                .unwrap_or_else(|| "source job has no reusable checkpoint for rerun".to_string()),
        )
    })?;
    let mut request = CreateJobInput {
        workflow,
        source: JobSourceInput {
            upload_id: source_job.request_payload.source.upload_id.clone(),
            source_url: source_job.request_payload.source.source_url.clone(),
            artifact_job_id: source_job.request_payload.source.artifact_job_id.clone(),
        },
        ocr: source_job.request_payload.ocr.clone(),
        translation: source_job.request_payload.translation.clone(),
        render: source_job.request_payload.render.clone(),
        runtime: source_job.request_payload.runtime.clone(),
    };
    request.source.upload_id.clear();
    request.source.source_url.clear();
    request.source.artifact_job_id = source_job.job_id.clone();
    request.runtime.job_id.clear();
    Ok(request)
}
