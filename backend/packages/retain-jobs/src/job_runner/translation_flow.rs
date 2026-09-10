use anyhow::Result;

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::domain::{now_iso, JobRuntimeState, JobStatusKind};
use crate::storage_paths::build_job_paths;

#[path = "translation_checkpoint_resume.rs"]
mod translation_checkpoint_resume;
#[path = "translation_flow_artifacts.rs"]
mod translation_flow_artifacts;
#[path = "translation_flow_child.rs"]
mod translation_flow_child;
#[path = "translation_flow_executor.rs"]
mod translation_flow_executor;
#[path = "translation_flow_stage.rs"]
mod translation_flow_stage;
#[path = "translation_flow_support.rs"]
mod translation_flow_support;

use self::translation_flow_child::{
    create_ocr_child_job, load_translation_upload_source, mark_parent_ocr_submitting,
};
use self::translation_flow_stage::{
    record_ocr_child_finished, run_render_stage_after_translation, run_translation_stage,
};
use self::translation_flow_support::finalize_parent_after_ocr;
use super::attach_job_paths;
use super::ocr_flow::{execute_ocr_job, sync_parent_with_ocr_child};
use super::pipeline_plan::PipelinePlan;
use super::ProcessRuntimeDeps;
use translation_flow_executor::run_after_translation_stage;

pub(super) async fn resume_translation_stage_from_durable_state(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    render_after_translation: bool,
) -> Result<JobRuntimeState> {
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) || !render_after_translation {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(
        deps,
        translated_job,
        &job_paths,
        &translation_stage.source_pdf_path,
    )
    .await
}

pub(super) async fn resume_render_stage_from_durable_state(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let artifacts = job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("durable render resume is missing job artifacts"))?;
    let render_inputs = crate::job_runner::stage_contract::translation_ready_inputs_for_render(
        artifacts,
        &deps.persist.data_root,
        &job.job_id,
    )?;
    run_render_stage_after_translation(deps, job, &job_paths, &render_inputs.source_pdf_path).await
}

pub(super) async fn run_translation_job_with_ocr(
    deps: ProcessRuntimeDeps,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    if !parent_job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .is_empty()
    {
        return run_book_job_from_artifacts(deps, parent_job).await;
    }
    run_job_with_ocr(deps, parent_job, PipelinePlan::book_with_ocr()).await
}

pub(super) async fn run_translate_only_job_with_ocr(
    deps: ProcessRuntimeDeps,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    if !parent_job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .is_empty()
    {
        return run_translate_only_job_from_artifacts(deps, parent_job).await;
    }
    run_job_with_ocr(deps, parent_job, PipelinePlan::translate_with_ocr()).await
}

async fn run_translate_only_job_from_artifacts(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let render_after_translation = job.request_payload.runtime.render_after_translation;
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    let (job, _source_pdf_path) = translation_flow_artifacts::prepare_job_from_ocr_artifacts(
        &deps,
        job,
        &source_job_id,
        "继续翻译",
    )
    .await?;
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    if !render_after_translation || !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(
        deps,
        translated_job,
        &job_paths,
        &translation_stage.source_pdf_path,
    )
    .await
}

async fn run_book_job_from_artifacts(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    let (job, _source_pdf_path) = translation_flow_artifacts::prepare_job_from_ocr_artifacts(
        &deps,
        job,
        &source_job_id,
        "继续翻译并渲染",
    )
    .await?;
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    let source_pdf_path = translation_stage.source_pdf_path;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(deps, translated_job, &job_paths, &source_pdf_path).await
}

async fn run_job_with_ocr(
    deps: ProcessRuntimeDeps,
    mut parent_job: JobRuntimeState,
    plan: PipelinePlan,
) -> Result<JobRuntimeState> {
    let parent_job_paths = build_job_paths(&deps.persist.output_root, &parent_job.job_id)?;
    attach_job_paths(&mut parent_job, &parent_job_paths);
    let source = load_translation_upload_source(deps.db.as_ref(), &parent_job)?;
    mark_parent_ocr_submitting(&deps, &mut parent_job)?;
    let ocr_child = create_ocr_child_job(&deps, &mut parent_job, &parent_job_paths, &source)?;

    let ocr_finished = execute_ocr_job(
        deps.clone(),
        ocr_child,
        Some(parent_job.job_id.clone()),
        Some(parent_job.job_id.clone()),
    )
    .await?;
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &ocr_finished,
    )?;
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    record_ocr_child_finished(&deps, &parent_job, &ocr_finished);

    if finalize_parent_after_ocr(&mut parent_job, &ocr_finished, now_iso())? {
        return Ok(parent_job);
    }

    let translation_stage = run_translation_stage(&deps, parent_job, &parent_job_paths).await?;
    let translated_job = translation_stage.job;
    let source_pdf_path = translation_stage.source_pdf_path;

    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_after_translation_stage(
        deps,
        &plan,
        translated_job,
        &parent_job_paths,
        &source_pdf_path,
    )
    .await
}
