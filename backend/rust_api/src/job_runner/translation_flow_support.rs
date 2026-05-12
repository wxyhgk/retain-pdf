use std::path::Path;

use anyhow::{anyhow, Result};

#[cfg(test)]
use crate::models::{JobArtifacts, JobSnapshot};
use crate::models::{
    job_stage_detail, job_stage_str, JobRuntimeState, JobStage, JobStatusKind,
};

use crate::job_runner::{clear_job_failure, refresh_job_failure, sync_runtime_state};

pub(super) struct TranslationInputs<'a> {
    pub(super) normalized_path: &'a Path,
    pub(super) source_pdf_path: &'a Path,
    pub(super) layout_json_path: Option<&'a Path>,
}

pub(super) fn finalize_parent_after_ocr(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
    timestamp: String,
) -> Result<bool> {
    match ocr_finished.status {
        JobStatusKind::Succeeded => Ok(false),
        JobStatusKind::Canceled => {
            parent_job.status = JobStatusKind::Canceled;
            parent_job.stage = Some(job_stage_str(JobStage::Canceled).to_string());
            parent_job.stage_detail = Some(job_stage_detail(JobStage::Canceled).to_string());
            parent_job.finished_at = Some(timestamp.clone());
            parent_job.updated_at = timestamp;
            clear_job_failure(parent_job);
            sync_runtime_state(parent_job);
            Ok(true)
        }
        _ => {
            parent_job.status = JobStatusKind::Failed;
            parent_job.stage = Some(job_stage_str(JobStage::Failed).to_string());
            parent_job.stage_detail = Some(job_stage_detail(JobStage::Failed).to_string());
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

pub(super) fn translation_inputs_from_artifacts(
    job: &JobRuntimeState,
) -> Result<TranslationInputs<'_>> {
    let artifacts = job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("OCR succeeded but artifacts are missing"))?;
    let checkpoint = artifacts.ocr_checkpoint();
    let normalized_path = checkpoint
        .normalized_document_json
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but normalized_document_json is missing"))?;
    let source_pdf_path = checkpoint
        .source_pdf
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but source_pdf is missing"))?;
    let layout_json_path = checkpoint.layout_json.map(Path::new);
    Ok(TranslationInputs {
        normalized_path,
        source_pdf_path,
        layout_json_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

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
