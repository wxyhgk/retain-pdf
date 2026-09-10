use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::models::domain::{JobArtifacts, JobRuntimeState};
#[cfg(test)]
use crate::{
    models::{domain::JobSnapshot, request::CreateJobInput},
    storage_paths::TRANSLATION_MANIFEST_FILE_NAME,
};

use super::artifact_requirements::{required_existing_dir, required_existing_file};

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
        // Stage module shape: python -m retainpdf_pipeline.<stage> [worker].
        if let Some(flag) = command.iter().position(|value| value == "-m") {
            let module = command.get(flag + 1).map(String::as_str);
            let worker = command.get(flag + 2).map(String::as_str);
            let contract = match (module, worker) {
                (Some("retainpdf_pipeline.translate"), _) => Some(WorkerContract::Translate),
                (Some("retainpdf_pipeline.render"), _) => Some(WorkerContract::Render),
                (Some("retainpdf_pipeline.ocr"), Some("normalize-ocr")) => {
                    Some(WorkerContract::Normalize)
                }
                (Some("retainpdf_pipeline.ocr"), _) => Some(WorkerContract::Provider),
                _ => None,
            };
            if let Some(contract) = contract {
                return contract;
            }
        }
        // Installed console shape: retainpdf-pipeline <subcommand>.
        if let Some(contract) = command.get(1).and_then(|value| match value.as_str() {
            "normalize-ocr" => Some(WorkerContract::Normalize),
            "translate-only" => Some(WorkerContract::Translate),
            "render-only" => Some(WorkerContract::Render),
            "provider-ocr" => Some(WorkerContract::Provider),
            _ => None,
        }) {
            return contract;
        }
        command
            .iter()
            .take_while(|value| value.as_str() != "--spec")
            .find_map(|value| {
                Path::new(value)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .and_then(|file_name| match file_name {
                        "run_normalize_ocr.py" => Some(WorkerContract::Normalize),
                        "run_translate_only.py" => Some(WorkerContract::Translate),
                        "run_render_only.py" => Some(WorkerContract::Render),
                        "run_provider_ocr.py" => Some(WorkerContract::Provider),
                        _ => None,
                    })
            })
            .unwrap_or(WorkerContract::Unknown)
    }
}

#[cfg(test)]
fn build_console_job(subcommand: &str) -> JobRuntimeState {
    JobSnapshot::new(
        "job-test".to_string(),
        CreateJobInput::default(),
        vec![
            "retainpdf-pipeline".to_string(),
            subcommand.to_string(),
            "--spec".to_string(),
            "/tmp/spec.json".to_string(),
        ],
    )
    .into_runtime()
}

#[cfg(test)]
fn build_stage_module_job(module: &str, worker: Option<&str>) -> JobRuntimeState {
    let mut command = vec![
        "python".to_string(),
        "-m".to_string(),
        module.to_string(),
    ];
    if let Some(worker) = worker {
        command.push(worker.to_string());
    }
    command.push("--spec".to_string());
    command.push("/tmp/spec.json".to_string());
    JobSnapshot::new(
        "job-test".to_string(),
        CreateJobInput::default(),
        command,
    )
    .into_runtime()
}

#[cfg(test)]
fn build_unbuffered_script_job(command_script: &str) -> JobRuntimeState {
    JobSnapshot::new(
        "job-test".to_string(),
        CreateJobInput::default(),
        vec![
            "python".to_string(),
            "-u".to_string(),
            format!("/tmp/scripts/{command_script}"),
            "--spec".to_string(),
            "/tmp/spec.json".to_string(),
        ],
    )
    .into_runtime()
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
    require_worker_file(
        data_root,
        artifacts.normalized_document_json.as_deref(),
        "normalized_document_json",
        &job.job_id,
    )?;
    require_worker_file(
        data_root,
        artifacts.normalization_report_json.as_deref(),
        "normalization_report_json",
        &job.job_id,
    )?;
    Ok(())
}

fn validate_translation_outputs(job: &JobRuntimeState, data_root: &Path) -> Result<()> {
    let artifacts = required_artifacts(job)?;
    let translations_dir = require_worker_dir(
        data_root,
        artifacts.translations_dir.as_deref(),
        "translations_dir",
        &job.job_id,
    )?;
    super::stage_contract::ensure_translations_dir_ready(&translations_dir, &job.job_id)?;
    require_worker_file(
        data_root,
        artifacts.summary.as_deref(),
        "summary",
        &job.job_id,
    )?;
    Ok(())
}

fn validate_render_outputs(job: &JobRuntimeState, data_root: &Path) -> Result<()> {
    let artifacts = required_artifacts(job)?;
    require_worker_file(
        data_root,
        artifacts.output_pdf.as_deref(),
        "output_pdf",
        &job.job_id,
    )?;
    require_worker_file(
        data_root,
        artifacts.summary.as_deref(),
        "summary",
        &job.job_id,
    )?;
    Ok(())
}

fn required_artifacts(job: &JobRuntimeState) -> Result<&JobArtifacts> {
    job.artifacts.as_ref().ok_or_else(|| {
        anyhow!(
            "worker succeeded but artifacts are missing for {}",
            job.job_id
        )
    })
}

fn require_worker_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    job_id: &str,
) -> Result<PathBuf> {
    required_existing_file(
        data_root,
        raw,
        artifact_key,
        job_id,
        format!("worker succeeded but {artifact_key} was not published for {job_id}"),
        "missing after successful worker",
    )
}

fn require_worker_dir(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    job_id: &str,
) -> Result<PathBuf> {
    required_existing_dir(
        data_root,
        raw,
        artifact_key,
        job_id,
        format!("worker succeeded but {artifact_key} was not published for {job_id}"),
        "missing after successful worker",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{JobArtifacts, JobSnapshot};
    use crate::models::request::CreateJobInput;

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
        assert_eq!(
            WorkerContract::from_command(
                &build_unbuffered_script_job("run_translate_only.py").command
            ),
            WorkerContract::Translate
        );
        assert_eq!(
            WorkerContract::from_command(&build_console_job("normalize-ocr").command),
            WorkerContract::Normalize
        );
        assert_eq!(
            WorkerContract::from_command(&build_console_job("render-only").command),
            WorkerContract::Render
        );
        assert_eq!(
            WorkerContract::from_command(
                &build_stage_module_job("retainpdf_pipeline.translate", None).command
            ),
            WorkerContract::Translate
        );
        assert_eq!(
            WorkerContract::from_command(
                &build_stage_module_job("retainpdf_pipeline.render", None).command
            ),
            WorkerContract::Render
        );
        assert_eq!(
            WorkerContract::from_command(
                &build_stage_module_job("retainpdf_pipeline.ocr", Some("normalize-ocr")).command
            ),
            WorkerContract::Normalize
        );
        assert_eq!(
            WorkerContract::from_command(
                &build_stage_module_job("retainpdf_pipeline.ocr", Some("provider-ocr")).command
            ),
            WorkerContract::Provider
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
