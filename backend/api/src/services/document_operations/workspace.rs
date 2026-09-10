use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use retain_core::models::domain::{
    DocumentOperationWorkspaceManifest, DocumentOperationWorkspaceState,
};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct OperationWorkspacePaths {
    pub root: PathBuf,
    pub source_pdf: PathBuf,
    pub program_json: PathBuf,
    pub limits_json: PathBuf,
    pub candidate_pdf: PathBuf,
    pub result_json: PathBuf,
    pub visual_validation_json: PathBuf,
    pub validation_json: PathBuf,
    pub stdout_log: PathBuf,
    pub stderr_log: PathBuf,
}

impl OperationWorkspacePaths {
    pub fn for_manifest(data_root: &Path, manifest: &DocumentOperationWorkspaceManifest) -> Self {
        let root = data_root
            .join("operations")
            .join(&manifest.operation_id)
            .join("attempts")
            .join(format!("{:04}", manifest.attempt));
        Self::from_root(root)
    }

    pub fn from_root(root: PathBuf) -> Self {
        Self {
            source_pdf: root.join("source").join("source.pdf"),
            program_json: root.join("program").join("program.json"),
            limits_json: root.join("program").join("limits.json"),
            candidate_pdf: root.join("outputs").join("candidate.pdf"),
            result_json: root.join("outputs").join("executor-result.json"),
            visual_validation_json: root.join("outputs").join("visual-validation.json"),
            validation_json: root.join("outputs").join("validation.json"),
            stdout_log: root.join("logs").join("stdout.log"),
            stderr_log: root.join("logs").join("stderr.log"),
            root,
        }
    }
}

pub fn materialize_operation_workspace(
    data_root: &Path,
    source_pdf: &Path,
    program: &Value,
    manifest: &DocumentOperationWorkspaceManifest,
    state: &DocumentOperationWorkspaceState,
) -> Result<OperationWorkspacePaths> {
    let paths = OperationWorkspacePaths::for_manifest(data_root, manifest);
    ensure_workspace_dirs(data_root, &paths)?;
    require_regular_file(source_pdf, "document source PDF")?;
    if paths.source_pdf.exists() {
        require_regular_file(&paths.source_pdf, "existing source PDF")?;
    } else {
        copy_file_atomic(source_pdf, &paths.source_pdf, true)?;
    }
    if sha256_file(&paths.source_pdf)? != manifest.source_pdf_sha256 {
        bail!("materialized source PDF hash does not match operation manifest");
    }
    if paths.program_json.exists() {
        require_regular_file(&paths.program_json, "existing page program")?;
    } else {
        write_json_atomic(&paths.program_json, program, true)?;
    }
    if sha256_file(&paths.program_json)? != manifest.program_sha256 {
        bail!("materialized program hash does not match operation manifest");
    }
    ensure_json_file(
        &paths.limits_json,
        &manifest.limits,
        true,
        "operation limits",
    )?;
    ensure_json_file(
        &paths.root.join("manifest.json"),
        manifest,
        true,
        "operation manifest",
    )?;
    let state_path = paths.root.join("state.json");
    if state_path.exists() {
        require_regular_file(&state_path, "operation state mirror")?;
        let existing: DocumentOperationWorkspaceState =
            serde_json::from_slice(&fs::read(&state_path)?)?;
        existing
            .validate_for(manifest)
            .map_err(anyhow::Error::msg)?;
    } else {
        write_json_atomic(&state_path, state, false)?;
    }
    Ok(paths)
}

pub fn write_validation_report<T: Serialize>(
    paths: &OperationWorkspacePaths,
    report: &T,
) -> Result<()> {
    write_json_atomic(&paths.validation_json, report, false)
}

pub fn write_state_mirror(
    paths: &OperationWorkspacePaths,
    state: &DocumentOperationWorkspaceState,
) -> Result<()> {
    write_json_atomic(&paths.root.join("state.json"), state, false)
}

pub fn sha256_file(path: &Path) -> Result<String> {
    require_regular_file(path, "hashed file")?;
    let mut stream = fs::File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];
    loop {
        let count = stream.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

pub fn require_regular_file(path: &Path, label: &str) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .with_context(|| format!("{label} is missing: {}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        bail!("{label} must be a regular non-symlink file");
    }
    Ok(())
}

fn ensure_workspace_dirs(data_root: &Path, paths: &OperationWorkspacePaths) -> Result<()> {
    let operations_root = data_root.join("operations");
    for directory in [
        operations_root.as_path(),
        paths
            .root
            .parent()
            .and_then(Path::parent)
            .unwrap_or(&paths.root),
        paths.root.parent().unwrap_or(&paths.root),
        paths.root.as_path(),
        paths.root.join("source").as_path(),
        paths.root.join("program").as_path(),
        paths.root.join("outputs").as_path(),
        paths.root.join("logs").as_path(),
    ] {
        fs::create_dir_all(directory)?;
        let metadata = fs::symlink_metadata(directory)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            bail!("operation workspace contains an unsafe directory");
        }
        set_mode(directory, 0o700)?;
    }
    Ok(())
}

fn copy_file_atomic(source: &Path, target: &Path, read_only: bool) -> Result<()> {
    let temporary = temporary_path(target);
    let result = (|| -> Result<()> {
        let mut input = fs::File::open(source)?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        std::io::copy(&mut input, &mut output)?;
        output.sync_all()?;
        set_mode(&temporary, if read_only { 0o400 } else { 0o600 })?;
        fs::rename(&temporary, target)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn ensure_json_file<T>(target: &Path, value: &T, read_only: bool, label: &str) -> Result<()>
where
    T: Serialize + serde::de::DeserializeOwned + PartialEq,
{
    if target.exists() {
        require_regular_file(target, label)?;
        let existing: T = serde_json::from_slice(&fs::read(target)?)?;
        if &existing != value {
            bail!("existing {label} does not match immutable attempt identity");
        }
        return Ok(());
    }
    write_json_atomic(target, value, read_only)
}

fn write_json_atomic<T: Serialize>(target: &Path, value: &T, read_only: bool) -> Result<()> {
    let temporary = temporary_path(target);
    let result = (|| -> Result<()> {
        let encoded = serde_json::to_vec(value)?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        output.write_all(&encoded)?;
        output.sync_all()?;
        set_mode(&temporary, if read_only { 0o400 } else { 0o600 })?;
        fs::rename(&temporary, target)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn temporary_path(target: &Path) -> PathBuf {
    target.with_extension(format!("tmp-{}-{}", std::process::id(), fastrand::u64(..)))
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: u32) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_mode(_path: &Path, _mode: u32) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use retain_core::models::domain::{
        DocumentOperationLimits, DocumentOperationStatus, DOCUMENT_OPERATION_MANIFEST_SCHEMA,
        DOCUMENT_OPERATION_SCHEMA_VERSION, DOCUMENT_OPERATION_STATE_SCHEMA,
    };

    fn digest(bytes: &[u8]) -> String {
        Sha256::digest(bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    #[test]
    fn materialization_completes_a_source_only_crash_remainder() {
        let data_root = std::env::temp_dir().join(format!(
            "retain-operation-partial-workspace-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&data_root).expect("create data root");
        let original_source = data_root.join("original.pdf");
        let source_bytes = b"immutable test source";
        fs::write(&original_source, source_bytes).expect("write original source");
        let program = serde_json::json!({
            "schema": "retainpdf_page_program_v1",
            "steps": [{"op": "select_pages", "pages": [1]}]
        });
        let program_bytes = serde_json::to_vec(&program).expect("encode program");
        let manifest = DocumentOperationWorkspaceManifest {
            schema: DOCUMENT_OPERATION_MANIFEST_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: "op-partial-workspace".to_string(),
            attempt: 2,
            dispatch_id: "dispatch-partial-workspace".to_string(),
            document_id: "document-partial".to_string(),
            base_job_id: "job-partial".to_string(),
            conversation_id: String::new(),
            request_message_id: "message-partial".to_string(),
            intent_summary: "finish partial workspace".to_string(),
            source_pdf_sha256: digest(source_bytes),
            normalized_document_sha256: None,
            program_sha256: digest(&program_bytes),
            executor_profile: "restricted_page_program_v1".to_string(),
            limits: DocumentOperationLimits {
                wall_time_seconds: 60,
                cpu_time_seconds: 45,
                memory_bytes: 512 * 1024 * 1024,
                scratch_bytes: 256 * 1024 * 1024,
                output_bytes: 128 * 1024 * 1024,
                process_count: 1,
                file_descriptor_count: 32,
                file_count: 16,
                stdout_bytes: 1024 * 1024,
                stderr_bytes: 1024 * 1024,
            },
            created_at: "2026-08-24T00:00:00Z".to_string(),
        };
        let state = DocumentOperationWorkspaceState {
            schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: manifest.operation_id.clone(),
            attempt: manifest.attempt,
            dispatch_id: manifest.dispatch_id.clone(),
            program_sha256: manifest.program_sha256.clone(),
            status: DocumentOperationStatus::Draft,
            dispatch_intent_at: None,
            dispatch_receipt: None,
            terminal_receipt_at: None,
            candidate_pdf_sha256: None,
            error_code: None,
            detail: None,
            updated_at: manifest.created_at.clone(),
        };
        let paths = OperationWorkspacePaths::for_manifest(&data_root, &manifest);
        fs::create_dir_all(paths.source_pdf.parent().expect("source parent"))
            .expect("create partial source directory");
        fs::copy(&original_source, &paths.source_pdf).expect("leave source-only remainder");

        let completed = materialize_operation_workspace(
            &data_root,
            &original_source,
            &program,
            &manifest,
            &state,
        )
        .expect("complete partial workspace");
        for path in [
            &completed.source_pdf,
            &completed.program_json,
            &completed.limits_json,
            &completed.root.join("manifest.json"),
            &completed.root.join("state.json"),
        ] {
            assert!(path.is_file(), "missing completed file: {}", path.display());
        }
        materialize_operation_workspace(&data_root, &original_source, &program, &manifest, &state)
            .expect("replay completed materialization");
    }
}
