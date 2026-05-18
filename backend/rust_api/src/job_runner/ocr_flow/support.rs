use anyhow::Result;

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::{job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind};

use super::super::{
    append_error_chain_log, attach_job_provider_failure, format_error_chain, job_artifacts_mut,
    refresh_job_failure, sync_runtime_state, ProcessRuntimeDeps,
};

pub(super) async fn save_ocr_job(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    parent_job_id: Option<&str>,
) -> Result<()> {
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        job,
    )?;
    if let Some(parent_job_id) = parent_job_id {
        mirror_parent_ocr_status(deps, parent_job_id, job).await?;
    }
    Ok(())
}

async fn mirror_parent_ocr_status(
    deps: &ProcessRuntimeDeps,
    parent_job_id: &str,
    ocr_job: &JobRuntimeState,
) -> Result<()> {
    let mut parent_job = deps.db.get_job(parent_job_id)?.into_runtime();
    if matches!(
        parent_job.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return Ok(());
    }
    let parent_artifacts = job_artifacts_mut(&mut parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_job.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_job.status.clone());
    parent_artifacts.ocr_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.trace_id.clone());
    parent_artifacts.ocr_provider_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.provider_trace_id.clone());
    parent_artifacts.ocr_provider_diagnostics = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.ocr_provider_diagnostics.clone());

    if parent_stage_allows_ocr_mirror(parent_job.stage.as_deref()) {
        parent_job.status = JobStatusKind::Running;
        parent_job.stage = Some(parent_ocr_stage_from_child(ocr_job.stage.as_deref()).to_string());
        parent_job.stage_detail = ocr_job
            .stage_detail
            .as_ref()
            .map(|detail| format!("OCR 子任务：{detail}"))
            .or_else(|| Some("OCR 子任务运行中".to_string()));
        parent_job.progress_current = ocr_job.progress_current;
        parent_job.progress_total = ocr_job.progress_total;
        parent_job.updated_at = now_iso();
        parent_job.replace_failure_info(None);
        parent_job.sync_runtime_state();
        persist_runtime_job_with_resources(
            deps.persist.db.as_ref(),
            &deps.persist.data_root,
            &deps.persist.output_root,
            &parent_job,
        )?;
    } else {
        parent_job.updated_at = now_iso();
        persist_runtime_job_with_resources(
            deps.persist.db.as_ref(),
            &deps.persist.data_root,
            &deps.persist.output_root,
            &parent_job,
        )?;
    }
    Ok(())
}

fn parent_stage_allows_ocr_mirror(stage: Option<&str>) -> bool {
    matches!(
        normalize_stage(stage),
        None | Some("queued")
            | Some("running")
            | Some("ocr_submitting")
            | Some("ocr_upload")
            | Some("mineru_upload")
            | Some("ocr_processing")
            | Some("mineru_processing")
            | Some("ocr_result_ready")
            | Some("translation_prepare")
            | Some("normalizing")
    )
}

fn parent_ocr_stage_from_child(stage: Option<&str>) -> &'static str {
    match normalize_stage(stage) {
        Some("translation_prepare" | "ocr_result_ready") => "ocr_result_ready",
        Some("normalizing") => "normalizing",
        Some("ocr_upload") => "ocr_upload",
        Some("mineru_upload") => "mineru_upload",
        Some("mineru_processing") => "mineru_processing",
        Some("ocr_processing") => "ocr_processing",
        Some("queued") => "ocr_submitting",
        _ => "ocr_submitting",
    }
}

fn normalize_stage(stage: Option<&str>) -> Option<&str> {
    stage.map(str::trim).filter(|value| !value.is_empty())
}

pub(super) fn fail_missing_source_pdf(
    job: &mut JobRuntimeState,
    source_pdf_path: &std::path::Path,
) {
    let message = format!("source pdf not found: {}", source_pdf_path.display());
    job.status = JobStatusKind::Failed;
    job.stage = Some(job_stage_str(JobStage::Failed).to_string());
    job.stage_detail = Some("OCR 已完成，但任务源 PDF 缺失".to_string());
    job.error = Some(message.clone());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.append_log(&message);
    refresh_job_failure(job);
    sync_runtime_state(job);
}

#[cfg(test)]
mod tests {
    use super::{parent_ocr_stage_from_child, parent_stage_allows_ocr_mirror};

    #[test]
    fn ocr_child_translation_prepare_is_exposed_as_ocr_result_ready() {
        assert_eq!(
            parent_ocr_stage_from_child(Some("translation_prepare")),
            "ocr_result_ready"
        );
    }

    #[test]
    fn translation_and_later_parent_stages_are_not_overwritten_by_ocr_child() {
        for stage in [
            "translating",
            "continuation_review",
            "page_policies",
            "domain_inference",
            "garbled_repair",
            "rendering",
            "saving",
            "finished",
        ] {
            assert!(
                !parent_stage_allows_ocr_mirror(Some(stage)),
                "{stage} should not allow OCR mirror"
            );
        }
    }

    #[test]
    fn ocr_parent_stages_can_still_follow_ocr_child_progress() {
        for stage in [
            None,
            Some("ocr_submitting"),
            Some("ocr_upload"),
            Some("ocr_processing"),
            Some("mineru_processing"),
            Some("ocr_result_ready"),
            Some("normalizing"),
        ] {
            assert!(parent_stage_allows_ocr_mirror(stage));
        }
    }
}

pub(super) fn fail_ocr_transport(job: &mut JobRuntimeState, err: &anyhow::Error) {
    let message = format_error_chain(err);
    append_error_chain_log(job, err);
    attach_job_provider_failure(job, &message);
    job.status = JobStatusKind::Failed;
    job.stage = Some(job_stage_str(JobStage::Failed).to_string());
    if job
        .stage_detail
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        job.stage_detail = Some("OCR provider transport 失败".to_string());
    }
    job.error = Some(message);
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    refresh_job_failure(job);
    sync_runtime_state(job);
}

pub fn sync_parent_with_ocr_child(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
) {
    let parent_artifacts = job_artifacts_mut(parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_finished.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_finished.status.clone());

    if let Some(child_artifacts) = ocr_finished.artifacts.as_ref() {
        parent_artifacts.copy_ocr_checkpoint_from(&ocr_finished.job_id, child_artifacts);
    }
}
