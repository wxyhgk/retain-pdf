use anyhow::{anyhow, Result};

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::{
    job_stage_detail, job_stage_str, now_iso, JobArtifacts, JobRuntimeState, JobStage,
    JobStatusKind,
};
use crate::storage_paths::{build_job_paths, resolve_data_path};

use super::{
    attach_job_paths, build_render_only_command, clear_job_failure, execute_process_job,
    sync_runtime_state, ProcessRuntimeDeps,
};

pub(super) async fn run_render_job_from_artifacts(
    deps: ProcessRuntimeDeps,
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
    let source_job = deps.db.get_job(&source_job_id)?;
    let source_artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("artifact source job has no artifacts: {source_job_id}"))?;
    let translation_outputs = source_artifacts.translation_outputs();
    let source_pdf_path = translation_outputs
        .source_pdf
        .ok_or_else(|| anyhow!("artifact source job is missing source_pdf: {source_job_id}"))
        .and_then(|raw| resolve_data_path(&deps.config.data_root, raw))?;
    let translations_dir = translation_outputs
        .translations_dir
        .ok_or_else(|| anyhow!("artifact source job is missing translations_dir: {source_job_id}"))
        .and_then(|raw| resolve_data_path(&deps.config.data_root, raw))?;
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

    let job_paths = build_job_paths(&deps.config.output_root, &job.job_id)?;
    attach_job_paths(&mut job, &job_paths);
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.copy_translation_inputs_from(source_artifacts);
    artifacts.translations_dir = translation_outputs.translations_dir.map(str::to_string);

    job.command = build_render_only_command(
        deps.config.as_ref(),
        &job.request_payload,
        &job_paths,
        &source_pdf_path,
        &translations_dir,
    );
    job.status = JobStatusKind::Running;
    job.started_at = Some(now_iso());
    job.updated_at = now_iso();
    job.stage = Some(job_stage_str(JobStage::Rendering).to_string());
    job.stage_detail = Some(job_stage_detail(JobStage::Rendering).to_string());
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.config.data_root,
        &deps.config.output_root,
        &job,
    )?;

    execute_process_job(deps, job, &[]).await
}
