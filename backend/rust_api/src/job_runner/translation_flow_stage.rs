use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::job_events::{
    persist_runtime_job_with_resources, record_custom_runtime_event_with_resources,
};
use crate::models::{
    job_stage_detail, job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind,
};
use crate::storage_paths::JobPaths;
use crate::worker_command::build_translate_only_command;

use crate::job_runner::{
    build_render_only_command, clear_job_failure, execute_process_job, sync_runtime_state,
    ProcessRuntimeDeps,
};

use crate::job_runner::stage_contract::{
    ensure_translations_dir_ready, ocr_ready_inputs_for_translation,
};

pub(super) struct TranslationStageResult {
    pub(super) job: JobRuntimeState,
    pub(super) source_pdf_path: PathBuf,
}

pub(super) fn record_ocr_child_finished(
    deps: &ProcessRuntimeDeps,
    parent_job: &JobRuntimeState,
    ocr_finished: &JobRuntimeState,
) {
    let ocr_finished_status = ocr_finished.status.clone();
    record_custom_runtime_event_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        if matches!(ocr_finished_status, JobStatusKind::Failed) {
            "error"
        } else {
            "info"
        },
        "ocr_child_finished",
        format!("OCR 子任务结束，状态={:?}", ocr_finished_status),
        Some(serde_json::json!({
            "ocr_job_id": ocr_finished.job_id.clone(),
            "status": format!("{:?}", ocr_finished_status).to_ascii_lowercase(),
        })),
    );
}

pub(super) async fn run_translation_stage(
    deps: &ProcessRuntimeDeps,
    mut parent_job: JobRuntimeState,
    parent_job_paths: &JobPaths,
) -> Result<TranslationStageResult> {
    let translate_inputs = ocr_ready_inputs_for_translation(&parent_job, &deps.persist.data_root)?;
    let normalized_path = translate_inputs.normalized_path;
    let source_pdf_path = translate_inputs.source_pdf_path;
    let layout_json_path = translate_inputs.layout_json_path;
    prepare_translation_stage(
        deps,
        &mut parent_job,
        parent_job_paths,
        &normalized_path,
        &source_pdf_path,
        layout_json_path.as_deref(),
    )?;
    let job = execute_process_job(deps.clone(), parent_job, &[]).await?;
    Ok(TranslationStageResult {
        job,
        source_pdf_path,
    })
}

fn prepare_translation_stage(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
    parent_job_paths: &JobPaths,
    normalized_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Result<()> {
    parent_job.command = build_translate_only_command(
        &deps.worker_command_runtime(),
        &parent_job.request_payload,
        parent_job_paths,
        normalized_path,
        source_pdf_path,
        layout_json_path,
    );
    parent_job.stage = Some(job_stage_str(JobStage::Translating).to_string());
    parent_job.stage_detail = Some(job_stage_detail(JobStage::Translating).to_string());
    parent_job.progress_current = None;
    parent_job.progress_total = None;
    parent_job.updated_at = now_iso();
    sync_runtime_state(parent_job);
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        parent_job,
    )?;

    Ok(())
}

pub(super) async fn run_render_stage_after_translation(
    deps: ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
) -> Result<JobRuntimeState> {
    ensure_translations_dir_ready(&job_paths.translated_dir, &job.job_id)?;
    job.command = build_render_only_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        job_paths,
        source_pdf_path,
        &job_paths.translated_dir,
    );
    job.status = JobStatusKind::Running;
    job.stage = Some(job_stage_str(JobStage::Rendering).to_string());
    job.stage_detail = Some(job_stage_detail(JobStage::Rendering).to_string());
    job.updated_at = now_iso();
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job,
    )?;
    execute_process_job(deps, job, &[]).await
}
