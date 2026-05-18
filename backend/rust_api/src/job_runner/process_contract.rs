use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::models::JobRuntimeState;
use crate::storage_paths::{resolve_data_path, TRANSLATION_MANIFEST_FILE_NAME};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum WorkerContract {
    Normalize,
    Translate,
    Render,
    Provider,
    Unknown,
}

impl WorkerContract {
    pub(super) fn from_command(command: &[String]) -> Self {
        let script = command.get(1).map(Path::new);
        let Some(file_name) = script
            .and_then(Path::file_name)
            .and_then(|name| name.to_str())
        else {
            return WorkerContract::Unknown;
        };
        match file_name {
            "run_normalize_ocr.py" => WorkerContract::Normalize,
            "run_translate_only.py" => WorkerContract::Translate,
            "run_render_only.py" => WorkerContract::Render,
            "run_provider_ocr.py" => WorkerContract::Provider,
            _ => WorkerContract::Unknown,
        }
    }
}

pub(super) fn validate_successful_worker_outputs(
    job: &JobRuntimeState,
    data_root: &Path,
) -> Result<()> {
    match WorkerContract::from_command(&job.command) {
        WorkerContract::Normalize => validate_normalize_outputs(job, data_root),
        WorkerContract::Translate => validate_translation_outputs(job, data_root),
        WorkerContract::Render => validate_render_outputs(job, data_root),
        WorkerContract::Provider | WorkerContract::Unknown => Ok(()),
    }
}

fn validate_normalize_outputs(job: &JobRuntimeState, data_root: &Path) -> Result<()> {
    let artifacts = required_artifacts(job)?;
    required_existing_file(
        data_root,
        artifacts.normalized_document_json.as_deref(),
        "normalized_document_json",
        &job.job_id,
    )?;
    required_existing_file(
        data_root,
        artifacts.normalization_report_json.as_deref(),
        "normalization_report_json",
        &job.job_id,
    )?;
    Ok(())
}

fn validate_translation_outputs(job: &JobRuntimeState, data_root: &Path) -> Result<()> {
    let artifacts = required_artifacts(job)?;
    let translations_dir = required_existing_dir(
        data_root,
        artifacts.translations_dir.as_deref(),
        "translations_dir",
        &job.job_id,
    )?;
    let manifest_path = translations_dir.join(TRANSLATION_MANIFEST_FILE_NAME);
    if !manifest_path.is_file() {
        return Err(anyhow!(
            "{} missing after successful translate worker for {}: {}",
            TRANSLATION_MANIFEST_FILE_NAME,
            job.job_id,
            manifest_path.display()
        ));
    }
    required_existing_file(
        data_root,
        artifacts.summary.as_deref(),
        "summary",
        &job.job_id,
    )?;
    Ok(())
}

fn validate_render_outputs(job: &JobRuntimeState, data_root: &Path) -> Result<()> {
    let artifacts = required_artifacts(job)?;
    required_existing_file(
        data_root,
        artifacts.output_pdf.as_deref(),
        "output_pdf",
        &job.job_id,
    )?;
    required_existing_file(
        data_root,
        artifacts.summary.as_deref(),
        "summary",
        &job.job_id,
    )?;
    Ok(())
}

fn required_artifacts(job: &JobRuntimeState) -> Result<&crate::models::JobArtifacts> {
    job.artifacts.as_ref().ok_or_else(|| {
        anyhow!(
            "worker succeeded but artifacts are missing for {}",
            job.job_id
        )
    })
}

fn required_existing_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    job_id: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, artifact_key, job_id)?;
    if !path.is_file() {
        return Err(anyhow!(
            "{artifact_key} missing after successful worker for {job_id}: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn required_existing_dir(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    job_id: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, artifact_key, job_id)?;
    if !path.is_dir() {
        return Err(anyhow!(
            "{artifact_key} missing after successful worker for {job_id}: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn required_path(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    job_id: &str,
) -> Result<PathBuf> {
    let raw = raw.ok_or_else(|| {
        anyhow!("worker succeeded but {artifact_key} was not published for {job_id}")
    })?;
    resolve_data_path(data_root, raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    fn build_job(command_script: &str) -> JobRuntimeState {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec![
                "python".to_string(),
                format!("/tmp/scripts/{command_script}"),
                "--spec".to_string(),
                "/tmp/spec.json".to_string(),
            ],
        )
        .into_runtime()
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "rust-api-process-contract-{name}-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn worker_contract_detects_known_scripts() {
        assert_eq!(
            WorkerContract::from_command(&build_job("run_render_only.py").command),
            WorkerContract::Render
        );
        assert_eq!(
            WorkerContract::from_command(&build_job("run_translate_only.py").command),
            WorkerContract::Translate
        );
        assert_eq!(
            WorkerContract::from_command(&build_job("custom.py").command),
            WorkerContract::Unknown
        );
    }

    #[test]
    fn translate_worker_success_requires_manifest_and_summary() {
        let root = temp_root("translate");
        let translated_dir = root.join("jobs/job-test/translated");
        let summary = root.join("jobs/job-test/artifacts/pipeline_summary.json");
        std::fs::create_dir_all(&translated_dir).expect("translated dir");
        std::fs::create_dir_all(summary.parent().expect("summary parent")).expect("summary dir");
        std::fs::write(&summary, b"{}").expect("summary");

        let mut job = build_job("run_translate_only.py");
        job.artifacts = Some(JobArtifacts {
            translations_dir: Some("jobs/job-test/translated".to_string()),
            summary: Some("jobs/job-test/artifacts/pipeline_summary.json".to_string()),
            ..JobArtifacts::default()
        });

        assert!(validate_successful_worker_outputs(&job, &root).is_err());
        std::fs::write(
            translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME),
            br#"{"pages":[]}"#,
        )
        .expect("manifest");
        validate_successful_worker_outputs(&job, &root).expect("valid translate outputs");
    }

    #[test]
    fn render_worker_success_requires_output_pdf() {
        let root = temp_root("render");
        let summary = root.join("jobs/job-test/artifacts/pipeline_summary.json");
        std::fs::create_dir_all(summary.parent().expect("summary parent")).expect("summary dir");
        std::fs::write(&summary, b"{}").expect("summary");

        let mut job = build_job("run_render_only.py");
        job.artifacts = Some(JobArtifacts {
            output_pdf: Some("jobs/job-test/rendered/output.pdf".to_string()),
            summary: Some("jobs/job-test/artifacts/pipeline_summary.json".to_string()),
            ..JobArtifacts::default()
        });
        assert!(validate_successful_worker_outputs(&job, &root).is_err());
    }
}
