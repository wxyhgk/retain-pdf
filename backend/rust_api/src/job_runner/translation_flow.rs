use std::path::Path;

use anyhow::{anyhow, Result};

use crate::job_events::{persist_runtime_job, record_custom_runtime_event};
use crate::models::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind};
use crate::storage_paths::build_job_paths;
use crate::AppState;

use super::commands::{build_ocr_command, build_translate_only_command};
use super::ocr_flow::{execute_ocr_job, sync_parent_with_ocr_child};
use super::{
    attach_job_paths, build_render_only_command, clear_job_failure, execute_process_job,
    refresh_job_failure, sync_runtime_state,
};

pub(super) async fn run_translation_job_with_ocr(
    state: AppState,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    run_job_with_ocr(state, parent_job, OcrContinuation::FullPipeline).await
}

pub(super) async fn run_translate_only_job_with_ocr(
    state: AppState,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    run_job_with_ocr(state, parent_job, OcrContinuation::TranslateOnly).await
}

#[derive(Clone, Copy)]
enum OcrContinuation {
    FullPipeline,
    TranslateOnly,
}

async fn run_job_with_ocr(
    state: AppState,
    mut parent_job: JobRuntimeState,
    continuation: OcrContinuation,
) -> Result<JobRuntimeState> {
    let parent_job_paths = build_job_paths(&state.config.output_root, &parent_job.job_id)?;
    attach_job_paths(&mut parent_job, &parent_job_paths);
    let upload_id = parent_job
        .upload_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| anyhow!("parent translation job is missing upload_id"))?;
    let upload = state.db.get_upload(&upload_id)?;
    let upload_path = Path::new(&upload.stored_path);
    if !upload_path.exists() {
        return Err(anyhow!("uploaded file missing: {}", upload.stored_path));
    }

    parent_job.status = JobStatusKind::Running;
    parent_job.started_at = Some(now_iso());
    parent_job.updated_at = now_iso();
    parent_job.stage = Some("ocr_submitting".to_string());
    parent_job.stage_detail = Some("正在启动 OCR 子任务".to_string());
    clear_job_failure(&mut parent_job);
    sync_runtime_state(&mut parent_job);
    persist_runtime_job(&state, &parent_job)?;

    let ocr_job_id = format!("{}-ocr", parent_job.job_id);
    let mut ocr_request = parent_job.request_payload.clone();
    ocr_request.workflow = crate::models::WorkflowKind::Ocr;
    ocr_request.job_id = ocr_job_id.clone();
    ocr_request.source.upload_id = upload_id.clone();
    let mut ocr_child = JobSnapshot::new(
        ocr_job_id.clone(),
        ocr_request.clone(),
        build_ocr_command(
            state.config.as_ref(),
            Some(upload_path),
            &ocr_request,
            &parent_job_paths,
        ),
    )
    .into_runtime();
    attach_job_paths(&mut ocr_child, &parent_job_paths);
    if let Some(artifacts) = ocr_child.artifacts.as_mut() {
        artifacts.trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.schema_version = Some("document.v1".to_string());
    }
    ocr_child.stage = Some("queued".to_string());
    ocr_child.stage_detail = Some("OCR 子任务已创建".to_string());
    sync_runtime_state(&mut ocr_child);
    persist_runtime_job(&state, &ocr_child)?;

    if let Some(artifacts) = parent_job.artifacts.as_mut() {
        artifacts.ocr_job_id = Some(ocr_job_id.clone());
        artifacts.ocr_trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.ocr_status = Some(JobStatusKind::Queued);
    }
    sync_runtime_state(&mut parent_job);
    persist_runtime_job(&state, &parent_job)?;
    record_custom_runtime_event(
        &state,
        &parent_job,
        "info",
        "ocr_child_created",
        "OCR 子任务已创建",
        Some(serde_json::json!({ "ocr_job_id": ocr_job_id })),
    );

    let ocr_finished = execute_ocr_job(
        state.clone(),
        ocr_child,
        Some(parent_job.job_id.clone()),
        Some(parent_job.job_id.clone()),
    )
    .await?;
    persist_runtime_job(&state, &ocr_finished)?;
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    let ocr_finished_status = ocr_finished.status.clone();
    record_custom_runtime_event(
        &state,
        &parent_job,
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

    if finalize_parent_after_ocr(&mut parent_job, &ocr_finished, now_iso())? {
        return Ok(parent_job);
    }

    let translate_inputs = translation_inputs_from_artifacts(&parent_job)?;
    let normalized_path = translate_inputs.normalized_path.to_path_buf();
    let source_pdf_path = translate_inputs.source_pdf_path.to_path_buf();
    let layout_json_path = translate_inputs.layout_json_path.map(Path::to_path_buf);

    parent_job.command = build_translate_only_command(
        state.config.as_ref(),
        &parent_job.request_payload,
        &parent_job_paths,
        &normalized_path,
        &source_pdf_path,
        layout_json_path.as_deref(),
    );
    parent_job.stage = Some("translating".to_string());
    parent_job.stage_detail = Some(match continuation {
        OcrContinuation::FullPipeline => "OCR 完成，开始翻译".to_string(),
        OcrContinuation::TranslateOnly => "OCR 完成，开始翻译".to_string(),
    });
    parent_job.updated_at = now_iso();
    sync_runtime_state(&mut parent_job);
    persist_runtime_job(&state, &parent_job)?;

    let translated_job = execute_process_job(state.clone(), parent_job, &[]).await?;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    match continuation {
        OcrContinuation::TranslateOnly => Ok(translated_job),
        OcrContinuation::FullPipeline => {
            run_render_stage_after_translation(
                state,
                translated_job,
                &parent_job_paths,
                &source_pdf_path,
            )
            .await
        }
    }
}

async fn run_render_stage_after_translation(
    state: AppState,
    mut job: JobRuntimeState,
    job_paths: &crate::storage_paths::JobPaths,
    source_pdf_path: &Path,
) -> Result<JobRuntimeState> {
    job.command = build_render_only_command(
        state.config.as_ref(),
        &job.request_payload,
        job_paths,
        source_pdf_path,
        &job_paths.translated_dir,
    );
    job.status = JobStatusKind::Running;
    job.stage = Some("rendering".to_string());
    job.stage_detail = Some("翻译完成，开始渲染".to_string());
    job.updated_at = now_iso();
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    persist_runtime_job(&state, &job)?;
    execute_process_job(state, job, &[]).await
}

struct TranslationInputs<'a> {
    normalized_path: &'a Path,
    source_pdf_path: &'a Path,
    layout_json_path: Option<&'a Path>,
}

fn finalize_parent_after_ocr(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
    timestamp: String,
) -> Result<bool> {
    match ocr_finished.status {
        JobStatusKind::Succeeded => Ok(false),
        JobStatusKind::Canceled => {
            parent_job.status = JobStatusKind::Canceled;
            parent_job.stage = Some("canceled".to_string());
            parent_job.stage_detail = Some("OCR 子任务已取消".to_string());
            parent_job.finished_at = Some(timestamp.clone());
            parent_job.updated_at = timestamp;
            clear_job_failure(parent_job);
            sync_runtime_state(parent_job);
            Ok(true)
        }
        _ => {
            parent_job.status = JobStatusKind::Failed;
            parent_job.stage = Some("failed".to_string());
            parent_job.stage_detail = Some("OCR 子任务失败".to_string());
            parent_job.error = ocr_finished
                .error
                .clone()
                .or(ocr_finished.stage_detail.clone());
            parent_job.finished_at = Some(timestamp.clone());
            parent_job.updated_at = timestamp;
            refresh_job_failure(parent_job);
            sync_runtime_state(parent_job);
            Ok(true)
        }
    }
}

fn translation_inputs_from_artifacts(job: &JobRuntimeState) -> Result<TranslationInputs<'_>> {
    let normalized_path = job
        .artifacts
        .as_ref()
        .and_then(|item| item.normalized_document_json.as_deref())
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but normalized_document_json is missing"))?;
    let source_pdf_path = job
        .artifacts
        .as_ref()
        .and_then(|item| item.source_pdf.as_deref())
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but source_pdf is missing"))?;
    let layout_json_path = job
        .artifacts
        .as_ref()
        .and_then(|item| item.layout_json.as_deref())
        .map(Path::new);
    Ok(TranslationInputs {
        normalized_path,
        source_pdf_path,
        layout_json_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    fn build_job() -> JobRuntimeState {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime()
    }

    #[test]
    fn finalize_parent_after_ocr_keeps_success_running_path() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Succeeded;
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(!done);
    }

    #[test]
    fn finalize_parent_after_ocr_marks_canceled() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Canceled;
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(done);
        assert_eq!(parent.status, JobStatusKind::Canceled);
        assert_eq!(parent.stage.as_deref(), Some("canceled"));
    }

    #[test]
    fn finalize_parent_after_ocr_marks_failed_and_copies_error() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Failed;
        ocr.error = Some("ocr failed".to_string());
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(done);
        assert_eq!(parent.status, JobStatusKind::Failed);
        assert_eq!(parent.error.as_deref(), Some("ocr failed"));
    }

    #[test]
    fn translation_inputs_from_artifacts_requires_normalized_and_source_pdf() {
        let job = build_job();
        assert!(translation_inputs_from_artifacts(&job).is_err());
    }

    #[test]
    fn translation_inputs_from_artifacts_extracts_paths() {
        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            normalized_document_json: Some("/tmp/doc.json".to_string()),
            source_pdf: Some("/tmp/source.pdf".to_string()),
            layout_json: Some("/tmp/layout.json".to_string()),
            ..JobArtifacts::default()
        });
        let inputs = translation_inputs_from_artifacts(&job).expect("inputs");
        assert_eq!(inputs.normalized_path, Path::new("/tmp/doc.json"));
        assert_eq!(inputs.source_pdf_path, Path::new("/tmp/source.pdf"));
        assert_eq!(inputs.layout_json_path, Some(Path::new("/tmp/layout.json")));
    }
}
