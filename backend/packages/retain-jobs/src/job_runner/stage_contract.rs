use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use sha2::{Digest, Sha256};

use crate::models::domain::{JobArtifacts, JobRuntimeState};
use crate::storage_paths::{TRANSLATION_CHECKPOINT_FILE_NAME, TRANSLATION_MANIFEST_FILE_NAME};

use super::artifact_requirements::{
    optional_existing_file, required_existing_dir, required_existing_file,
};

pub(super) fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    Sha256::digest(bytes.as_ref())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

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

pub fn translation_artifacts_are_ready(
    artifacts: &JobArtifacts,
    data_root: &Path,
    source_job_id: &str,
) -> bool {
    translation_ready_inputs_for_render(artifacts, data_root, source_job_id).is_ok()
}

pub fn translation_checkpoint_candidate_is_ready(
    artifacts: &JobArtifacts,
    data_root: &Path,
    source_job_id: &str,
) -> bool {
    translation_checkpoint_candidate(artifacts, data_root, source_job_id).is_ok()
}

fn translation_checkpoint_candidate(
    artifacts: &JobArtifacts,
    data_root: &Path,
    source_job_id: &str,
) -> Result<()> {
    let checkpoint_path = required_file(
        data_root,
        artifacts.translation_checkpoint_json.as_deref(),
        "translation_checkpoint_json",
        source_job_id,
    )?;
    let payload: serde_json::Value = serde_json::from_slice(&std::fs::read(&checkpoint_path)?)
        .map_err(|error| {
            anyhow!(
                "invalid {} for {source_job_id}: {error}",
                TRANSLATION_CHECKPOINT_FILE_NAME
            )
        })?;
    if payload.get("schema").and_then(serde_json::Value::as_str)
        != Some("translation_checkpoint_v1")
        || payload
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            != Some(1)
        || !matches!(
            payload.get("status").and_then(serde_json::Value::as_str),
            Some("in_progress" | "complete")
        )
        || payload
            .get("fingerprint")
            .and_then(serde_json::Value::as_str)
            .is_none_or(str::is_empty)
    {
        return Err(anyhow!(
            "unsupported translation checkpoint candidate for {source_job_id}: {}",
            checkpoint_path.display()
        ));
    }
    let parent = checkpoint_path
        .parent()
        .ok_or_else(|| anyhow!("translation checkpoint has no parent for {source_job_id}"))?;
    validate_checkpoint_pages(&payload, parent, source_job_id, true, true)?;
    Ok(())
}

pub(super) struct CheckpointPageSource {
    pub(super) file_name: String,
    pub(super) source_path: PathBuf,
    pub(super) snapshot_relative: Option<PathBuf>,
}

fn validate_checkpoint_pages(
    payload: &serde_json::Value,
    parent: &Path,
    source_label: &str,
    pages_required: bool,
    allow_committed_snapshot: bool,
) -> Result<()> {
    let Some(pages) = payload.get("pages").and_then(serde_json::Value::as_array) else {
        if pages_required {
            return Err(anyhow!(
                "translation checkpoint pages missing for {source_label}"
            ));
        }
        return Ok(());
    };
    for page in pages {
        resolve_checkpoint_page_source(page, parent, source_label, allow_committed_snapshot)?;
    }
    Ok(())
}

pub(super) fn resolve_checkpoint_page_source(
    page: &serde_json::Value,
    parent: &Path,
    source_label: &str,
    allow_committed_snapshot: bool,
) -> Result<CheckpointPageSource> {
    let relative = page
        .get("path")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow!("translation checkpoint page path missing for {source_label}"))?;
    let file_name = safe_checkpoint_page_name(relative).ok_or_else(|| {
        anyhow!("unsafe translation checkpoint page path for {source_label}: {relative}")
    })?;
    let snapshot_relative = if allow_committed_snapshot {
        page.get("snapshot_path")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.is_empty())
            .map(|snapshot| {
                safe_checkpoint_snapshot_path(snapshot, &file_name).ok_or_else(|| {
                    anyhow!(
                        "unsafe translation checkpoint snapshot path for {source_label}: {snapshot}"
                    )
                })
            })
            .transpose()?
    } else {
        None
    };
    let source_path = snapshot_relative
        .as_ref()
        .map(|snapshot| parent.join(snapshot))
        .unwrap_or_else(|| parent.join(&file_name));
    let metadata = std::fs::symlink_metadata(&source_path).map_err(|_| {
        let kind = if snapshot_relative.is_some() {
            "snapshot"
        } else {
            "page file"
        };
        anyhow!("translation checkpoint {kind} missing for {source_label}: {relative}")
    })?;
    if !metadata.file_type().is_file() {
        return Err(anyhow!(
            "translation checkpoint source is not a regular file for {source_label}: {relative}"
        ));
    }
    if let Some(expected_hash) = page
        .get("page_hash")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
    {
        let actual_hash = sha256_hex(std::fs::read(&source_path)?);
        if expected_hash != actual_hash {
            let kind = if snapshot_relative.is_some() {
                "snapshot hash mismatch"
            } else {
                "page hash mismatch"
            };
            return Err(anyhow!(
                "translation checkpoint {kind} for {source_label}: {relative}"
            ));
        }
    }
    Ok(CheckpointPageSource {
        file_name,
        source_path,
        snapshot_relative,
    })
}

fn safe_checkpoint_page_name(relative: &str) -> Option<String> {
    let path = Path::new(relative);
    let file_name = path.file_name()?.to_str()?;
    if path.components().count() != 1
        || !file_name.starts_with("page-")
        || !file_name.ends_with(".json")
    {
        return None;
    }
    Some(file_name.to_string())
}

fn safe_checkpoint_snapshot_path(relative: &str, page_name: &str) -> Option<PathBuf> {
    let path = Path::new(relative);
    let mut components = path.components();
    let root = components.next()?.as_os_str().to_str()?;
    let generation = components.next()?.as_os_str().to_str()?;
    let file_name = components.next()?.as_os_str().to_str()?;
    if components.next().is_some()
        || root != ".translation-checkpoints"
        || generation
            .strip_prefix("generation-")
            .is_none_or(|value| value.is_empty() || !value.chars().all(|ch| ch.is_ascii_digit()))
        || file_name != page_name
    {
        return None;
    }
    Some(path.to_path_buf())
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
    required_existing_file(
        data_root,
        raw,
        artifact_key,
        source_label,
        format!("{source_label} is missing {artifact_key}"),
        "not found",
    )
}

fn optional_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<Option<PathBuf>> {
    optional_existing_file(data_root, raw, artifact_key, source_label, "not found")
}

fn required_dir(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
) -> Result<PathBuf> {
    required_existing_dir(
        data_root,
        raw,
        artifact_key,
        source_label,
        format!("{source_label} is missing {artifact_key}"),
        "not found",
    )
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
    require_completed_checkpoint_if_present(translations_dir, &manifest_path, source_label)
}

fn require_completed_checkpoint_if_present(
    translations_dir: &Path,
    manifest_path: &Path,
    source_label: &str,
) -> Result<()> {
    let checkpoint_path = translations_dir.join(TRANSLATION_CHECKPOINT_FILE_NAME);
    if !checkpoint_path.exists() {
        // Completed jobs created before checkpoint.v1 remain renderable.
        return Ok(());
    }
    if !checkpoint_path.is_file() {
        return Err(anyhow!(
            "{} is not a regular file for {source_label}: {}",
            TRANSLATION_CHECKPOINT_FILE_NAME,
            checkpoint_path.display()
        ));
    }
    let checkpoint: serde_json::Value = serde_json::from_slice(&std::fs::read(&checkpoint_path)?)
        .map_err(|error| {
        anyhow!(
            "invalid {} for {source_label}: {error}",
            TRANSLATION_CHECKPOINT_FILE_NAME
        )
    })?;
    if checkpoint.get("schema").and_then(serde_json::Value::as_str)
        != Some("translation_checkpoint_v1")
        || checkpoint
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            != Some(1)
    {
        return Err(anyhow!(
            "unsupported {} contract for {source_label}",
            TRANSLATION_CHECKPOINT_FILE_NAME
        ));
    }
    if checkpoint.get("status").and_then(serde_json::Value::as_str) != Some("complete")
        || checkpoint.get("phase").and_then(serde_json::Value::as_str) != Some("committed")
        || checkpoint
            .get("final_manifest")
            .and_then(serde_json::Value::as_str)
            != Some(TRANSLATION_MANIFEST_FILE_NAME)
        || checkpoint
            .get("fingerprint")
            .and_then(serde_json::Value::as_str)
            .is_none_or(str::is_empty)
    {
        return Err(anyhow!(
            "translation checkpoint is not committed for {source_label}: {}",
            checkpoint_path.display()
        ));
    }
    validate_checkpoint_pages(&checkpoint, translations_dir, source_label, false, false)?;

    let manifest: serde_json::Value = serde_json::from_slice(&std::fs::read(manifest_path)?)
        .map_err(|error| anyhow!("invalid translation manifest for {source_label}: {error}"))?;
    if manifest.get("schema").and_then(serde_json::Value::as_str) != Some("translation_manifest_v1")
        || manifest
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            != Some(1)
        || manifest.get("status").and_then(serde_json::Value::as_str) != Some("complete")
    {
        return Err(anyhow!(
            "translation manifest is not complete for {source_label}: {}",
            manifest_path.display()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

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

        std::fs::write(
            translated_dir.join(TRANSLATION_CHECKPOINT_FILE_NAME),
            br#"{
                "schema":"translation_checkpoint_v1",
                "schema_version":1,
                "status":"in_progress",
                "phase":"validating",
                "fingerprint":"fingerprint-a",
                "final_manifest":null
            }"#,
        )
        .expect("in-progress checkpoint");
        assert!(translation_ready_inputs_for_render(&artifacts, &root, "job-test").is_err());

        std::fs::write(
            translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME),
            br#"{
                "schema":"translation_manifest_v1",
                "schema_version":1,
                "status":"complete",
                "pages":[]
            }"#,
        )
        .expect("completed manifest");
        std::fs::write(
            translated_dir.join(TRANSLATION_CHECKPOINT_FILE_NAME),
            br#"{
                "schema":"translation_checkpoint_v1",
                "schema_version":1,
                "status":"complete",
                "phase":"committed",
                "fingerprint":"fingerprint-a",
                "final_manifest":"translation-manifest.json"
            }"#,
        )
        .expect("completed checkpoint");
        translation_ready_inputs_for_render(&artifacts, &root, "job-test")
            .expect("completed checkpoint is renderable");
    }

    #[test]
    fn checkpoint_page_hash_rejects_file_ahead_of_commit_marker() {
        let root = temp_root("page-hash");
        let page = root.join("page-001-deepseek.json");
        std::fs::write(&page, b"committed").expect("committed page");
        let committed_hash = sha256_hex(b"committed");
        let checkpoint = serde_json::json!({
            "pages": [{
                "path": "page-001-deepseek.json",
                "page_hash": committed_hash,
            }]
        });
        validate_checkpoint_pages(&checkpoint, &root, "job-test", true, false)
            .expect("matching page hash");

        std::fs::write(&page, b"saved after last checkpoint").expect("uncommitted page save");
        let error = validate_checkpoint_pages(&checkpoint, &root, "job-test", true, false)
            .expect_err("page ahead of checkpoint must be rejected");
        assert!(error.to_string().contains("page hash mismatch"));
    }

    #[test]
    fn checkpoint_resume_uses_committed_snapshot_when_working_page_is_ahead() {
        let root = temp_root("page-snapshot");
        let page_name = "page-001-deepseek.json";
        let page = root.join(page_name);
        let snapshot_relative = Path::new(".translation-checkpoints")
            .join("generation-2")
            .join(page_name);
        let snapshot = root.join(&snapshot_relative);
        std::fs::create_dir_all(snapshot.parent().expect("snapshot parent")).expect("mkdir");
        std::fs::write(&snapshot, b"committed").expect("committed snapshot");
        std::fs::write(&page, b"saved after last checkpoint").expect("working page");
        let checkpoint = serde_json::json!({
            "pages": [{
                "path": page_name,
                "page_hash": sha256_hex(b"committed"),
                "snapshot_path": snapshot_relative.to_string_lossy(),
            }]
        });

        validate_checkpoint_pages(&checkpoint, &root, "job-test", true, true)
            .expect("committed snapshot is the resumable source");
        let error = validate_checkpoint_pages(&checkpoint, &root, "job-test", true, false)
            .expect_err("completed artifacts still validate their public page file");
        assert!(error.to_string().contains("page hash mismatch"));
    }
}
