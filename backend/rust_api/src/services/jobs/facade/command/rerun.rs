use crate::error::AppError;
use crate::models::now_iso;
use crate::models::{
    CreateJobInput, JobArtifacts, JobSnapshot, JobSourceInput, JobStatusKind, JobSubmissionView,
    WorkflowKind,
};

use super::super::super::creation::create_translation_job;
use super::super::super::query::load_job_or_404;
use super::super::JobsFacade;
use crate::services::job_launcher::start_job_execution;

impl<'a> JobsFacade<'a> {
    pub fn rerun_submission(
        &self,
        base_url: &str,
        source_job_id: &str,
    ) -> Result<JobSubmissionView, AppError> {
        let source_job = load_job_or_404(self.command.db, source_job_id)?;
        if can_rerender_in_place(source_job.artifacts.as_ref()) {
            let job = prepare_in_place_render_job(source_job)?;
            let job = start_job_execution(&self.command.submit.launcher, job)?;
            return Ok(self.build_submission_view(
                base_url,
                &job,
                JobStatusKind::Queued,
                WorkflowKind::Render,
            ));
        }
        let request = build_rerun_request(&source_job)?;
        let workflow = request.workflow.clone();
        let job = create_translation_job(&self.command.submit, &request)?;
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, workflow))
    }
}

fn prepare_in_place_render_job(mut job: JobSnapshot) -> Result<JobSnapshot, AppError> {
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

fn build_rerun_request(source_job: &JobSnapshot) -> Result<CreateJobInput, AppError> {
    let artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| AppError::bad_request("source job has no reusable artifacts"))?;
    let workflow = choose_rerun_workflow(artifacts)?;
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

fn choose_rerun_workflow(artifacts: &JobArtifacts) -> Result<WorkflowKind, AppError> {
    if has_text(&artifacts.translations_dir) && has_text(&artifacts.source_pdf) {
        return Ok(WorkflowKind::Render);
    }
    if has_text(&artifacts.normalized_document_json) && has_text(&artifacts.source_pdf) {
        return Ok(WorkflowKind::Book);
    }
    Err(AppError::bad_request(
        "source job has no reusable checkpoint; need translations_dir+source_pdf or normalized_document_json+source_pdf",
    ))
}

fn can_rerender_in_place(artifacts: Option<&JobArtifacts>) -> bool {
    artifacts.is_some_and(|item| has_text(&item.translations_dir) && has_text(&item.source_pdf))
}

fn has_text(value: &Option<String>) -> bool {
    value
        .as_deref()
        .map(str::trim)
        .is_some_and(|item| !item.is_empty())
}
