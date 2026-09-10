use std::path::PathBuf;

use anyhow::{anyhow, Result};

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::domain::{JobArtifacts, JobRuntimeState};
use crate::storage_paths::build_job_paths;

use super::translation_checkpoint_resume::import_translation_checkpoint_candidate;
use crate::job_runner::stage_contract::ocr_ready_inputs_for_translation;
use crate::job_runner::{attach_job_paths, ProcessRuntimeDeps};

pub(super) async fn prepare_job_from_ocr_artifacts(
    deps: &ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    source_job_id: &str,
    action_label: &str,
) -> Result<(JobRuntimeState, PathBuf)> {
    let source_job = deps.db.get_job(&source_job_id)?;
    let source_artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("artifact source job has no artifacts: {source_job_id}"))?;
    let source_runtime = source_job.clone().into_runtime();
    let ocr_inputs = ocr_ready_inputs_for_translation(&source_runtime, &deps.persist.data_root)?;
    let source_pdf_path = ocr_inputs.source_pdf_path;
    let normalized_path = ocr_inputs.normalized_path;
    let layout_json_path = ocr_inputs.layout_json_path;

    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    import_translation_checkpoint_candidate(
        &deps.persist.output_root,
        &source_job.job_id,
        &source_job.status,
        &job_paths.translated_dir,
    )?;
    attach_job_paths(&mut job, &job_paths);
    copy_ocr_checkpoint_artifacts(&mut job, &source_job_id, source_artifacts);
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.copy_translation_inputs_from(source_artifacts);
        artifacts.source_pdf = Some(source_pdf_path.to_string_lossy().to_string());
        artifacts.normalized_document_json = Some(normalized_path.to_string_lossy().to_string());
        artifacts.layout_json = layout_json_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string());
    }
    job.stage_detail = Some(format!(
        "正在基于任务 {source_job_id} 的 OCR 产物{action_label}"
    ));
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job,
    )?;
    Ok((job, source_pdf_path))
}

fn copy_ocr_checkpoint_artifacts(
    job: &mut JobRuntimeState,
    source_job_id: &str,
    source_artifacts: &JobArtifacts,
) {
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.copy_ocr_checkpoint_from(source_job_id, source_artifacts);
}
