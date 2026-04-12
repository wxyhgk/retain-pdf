use anyhow::{anyhow, Result};

use crate::job_events::persist_runtime_job;
use crate::models::{now_iso, JobArtifacts, JobRuntimeState, JobStatusKind};
use crate::storage_paths::{build_job_paths, resolve_data_path};
use crate::AppState;

use super::{
    attach_job_paths, build_render_only_command, clear_job_failure, execute_process_job,
    sync_runtime_state,
};

pub(super) async fn run_render_job_from_artifacts(
    state: AppState,
    mut job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    if source_job_id.is_empty() {
        return Err(anyhow!("render workflow requires source.artifact_job_id"));
    }
    let source_job = state.db.get_job(&source_job_id)?;
    let source_artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("artifact source job has no artifacts: {source_job_id}"))?;
    let source_pdf_path = source_artifacts
        .source_pdf
        .as_deref()
        .ok_or_else(|| anyhow!("artifact source job is missing source_pdf: {source_job_id}"))
        .and_then(|raw| resolve_data_path(&state.config.data_root, raw))?;
    let translations_dir = source_artifacts
        .translations_dir
        .as_deref()
        .ok_or_else(|| anyhow!("artifact source job is missing translations_dir: {source_job_id}"))
        .and_then(|raw| resolve_data_path(&state.config.data_root, raw))?;
    if !source_pdf_path.exists() {
        return Err(anyhow!(
            "source_pdf not found for artifact job {source_job_id}: {}",
            source_pdf_path.display()
        ));
    }
    if !translations_dir.exists() {
        return Err(anyhow!(
            "translations_dir not found for artifact job {source_job_id}: {}",
            translations_dir.display()
        ));
    }

    let job_paths = build_job_paths(&state.config.output_root, &job.job_id)?;
    attach_job_paths(&mut job, &job_paths);
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.source_pdf = source_artifacts.source_pdf.clone();
    artifacts.layout_json = source_artifacts.layout_json.clone();
    artifacts.normalized_document_json = source_artifacts.normalized_document_json.clone();
    artifacts.normalization_report_json = source_artifacts.normalization_report_json.clone();
    artifacts.schema_version = source_artifacts.schema_version.clone();
    artifacts.translations_dir = source_artifacts.translations_dir.clone();

    job.command = build_render_only_command(
        &state,
        &job.request_payload,
        &job_paths,
        &source_pdf_path,
        &translations_dir,
    );
    job.status = JobStatusKind::Running;
    job.started_at = Some(now_iso());
    job.updated_at = now_iso();
    job.stage = Some("rendering".to_string());
    job.stage_detail = Some("正在基于已有翻译产物重新渲染".to_string());
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    persist_runtime_job(&state, &job)?;

    execute_process_job(state, job, &[]).await
}
