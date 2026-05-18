use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::models::{JobArtifacts, JobRuntimeState};
use crate::storage_paths::{resolve_data_path, TRANSLATION_MANIFEST_FILE_NAME};

pub(super) struct OcrReadyInputs {
    pub(super) normalized_path: PathBuf,
    pub(super) source_pdf_path: PathBuf,
    pub(super) layout_json_path: Option<PathBuf>,
}

pub(super) struct TranslationReadyInputs {
    pub(super) source_pdf_path: PathBuf,
    pub(super) translations_dir: PathBuf,
}

pub(super) fn ocr_ready_inputs_for_translation(
    job: &JobRuntimeState,
    data_root: &Path,
) -> Result<OcrReadyInputs> {
    let artifacts = job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("OCR succeeded but artifacts are missing"))?;
    let checkpoint = artifacts.ocr_checkpoint();
    let normalized_path = required_file(
        data_root,
        checkpoint.normalized_document_json,
        "normalized_document_json",
        &job.job_id,
    )?;
    let source_pdf_path =
        required_file(data_root, checkpoint.source_pdf, "source_pdf", &job.job_id)?;
    let layout_json_path = optional_file(
        data_root,
        checkpoint.layout_json,
        "layout_json",
        &job.job_id,
    )?;
    Ok(OcrReadyInputs {
        normalized_path,
        source_pdf_path,
        layout_json_path,
    })
}

pub(super) fn translation_ready_inputs_for_render(
    artifacts: &JobArtifacts,
    data_root: &Path,
    source_job_id: &str,
) -> Result<TranslationReadyInputs> {
    let outputs = artifacts.translation_outputs();
    let source_pdf_path =
        required_file(data_root, outputs.source_pdf, "source_pdf", source_job_id)?;
    let translations_dir = required_dir(
        data_root,
        outputs.translations_dir,
        "translations_dir",
        source_job_id,
    )?;
    require_translation_manifest(&translations_dir, source_job_id)?;
    Ok(TranslationReadyInputs {
        source_pdf_path,
        translations_dir,
    })
}

pub(super) fn ensure_translations_dir_ready(
    translations_dir: &Path,
    source_label: &str,
) -> Result<()> {
    if !translations_dir.is_dir() {
        return Err(anyhow!(
            "translations_dir not found for {source_label}: {}",
            translations_dir.display()
        ));
    }
    require_translation_manifest(translations_dir, source_label)
}

fn required_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, artifact_key, source_label)?;
    if !path.is_file() {
        return Err(anyhow!(
            "{artifact_key} not found for {source_label}: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn optional_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<Option<PathBuf>> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let path = resolve_data_path(data_root, raw)?;
    if !path.is_file() {
        return Err(anyhow!(
            "{artifact_key} not found for {source_label}: {}",
            path.display()
        ));
    }
    Ok(Some(path))
}

fn required_dir(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, artifact_key, source_label)?;
    if !path.is_dir() {
        return Err(anyhow!(
            "{artifact_key} not found for {source_label}: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn required_path(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<PathBuf> {
    let raw = raw.ok_or_else(|| anyhow!("{source_label} is missing {artifact_key}"))?;
    resolve_data_path(data_root, raw)
}

fn require_translation_manifest(translations_dir: &Path, source_label: &str) -> Result<()> {
    let manifest_path = translations_dir.join(TRANSLATION_MANIFEST_FILE_NAME);
    if !manifest_path.is_file() {
        return Err(anyhow!(
            "{} not found for {source_label}: {}",
            TRANSLATION_MANIFEST_FILE_NAME,
            manifest_path.display()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreateJobInput, JobSnapshot};

    fn build_job() -> JobRuntimeState {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime()
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "rust-api-stage-contract-{name}-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn ocr_ready_inputs_resolves_relative_paths_under_data_root() {
        let root = temp_root("ocr-ready");
        let source_pdf = root.join("jobs/job-test/source/source.pdf");
        let normalized = root.join("jobs/job-test/ocr/normalized.json");
        let layout = root.join("jobs/job-test/ocr/layout.json");
        std::fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("mkdir");
        std::fs::create_dir_all(normalized.parent().expect("normalized parent")).expect("mkdir");
        std::fs::write(&source_pdf, b"%PDF").expect("source pdf");
        std::fs::write(&normalized, b"{}").expect("normalized");
        std::fs::write(&layout, b"{}").expect("layout");

        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            source_pdf: Some("jobs/job-test/source/source.pdf".to_string()),
            normalized_document_json: Some("jobs/job-test/ocr/normalized.json".to_string()),
            layout_json: Some("jobs/job-test/ocr/layout.json".to_string()),
            ..JobArtifacts::default()
        });

        let inputs = ocr_ready_inputs_for_translation(&job, &root).expect("ready inputs");
        assert_eq!(inputs.source_pdf_path, source_pdf);
        assert_eq!(inputs.normalized_path, normalized);
        assert_eq!(inputs.layout_json_path, Some(layout));
    }

    #[test]
    fn translation_ready_inputs_requires_manifest() {
        let root = temp_root("translation-ready");
        let source_pdf = root.join("jobs/job-test/source/source.pdf");
        let translated_dir = root.join("jobs/job-test/translated");
        std::fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("mkdir");
        std::fs::create_dir_all(&translated_dir).expect("translated dir");
        std::fs::write(&source_pdf, b"%PDF").expect("source pdf");

        let artifacts = JobArtifacts {
            source_pdf: Some("jobs/job-test/source/source.pdf".to_string()),
            translations_dir: Some("jobs/job-test/translated".to_string()),
            ..JobArtifacts::default()
        };

        assert!(translation_ready_inputs_for_render(&artifacts, &root, "job-test").is_err());
        std::fs::write(
            translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME),
            br#"{"pages":[]}"#,
        )
        .expect("manifest");
        let inputs =
            translation_ready_inputs_for_render(&artifacts, &root, "job-test").expect("ready");
        assert_eq!(inputs.source_pdf_path, source_pdf);
        assert_eq!(inputs.translations_dir, translated_dir);
    }
}
