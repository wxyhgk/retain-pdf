use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Duration, Utc};
use retain_core::config::pipeline_command_is_available;
use retain_core::models::domain::{
    now_iso, validate_operation_id, DocumentOperationDispatchReceipt,
    DocumentOperationWorkspaceManifest,
};
use serde::{Deserialize, Serialize};

use super::workspace::{require_regular_file, sha256_file, OperationWorkspacePaths};

pub const CONTROL_PLANE_PREVIEW_PROFILE: &str = "control_plane_preview_v1";
pub const RESTRICTED_PAGE_PROGRAM_PROFILE: &str = "restricted_page_program_v1";
const CONTROL_PLANE_PREVIEW_DIGEST: &str =
    "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const RESTRICTED_PAGE_PROGRAM_DIGEST: &str =
    "33d8e0224ec0ea4505c5a010fa4a83caaa2a8dab5fdc15325650898da3ff4696";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutorCapabilityReport {
    pub available: bool,
    pub profile_id: String,
    pub profile_digest: String,
    pub executes_model_code: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecutorObservation {
    NotFound,
    Accepted(DocumentOperationDispatchReceipt),
    Completed {
        receipt: DocumentOperationDispatchReceipt,
        terminal_at: String,
        candidate_pdf_sha256: String,
    },
    Cancelled {
        receipt: DocumentOperationDispatchReceipt,
        terminal_at: String,
    },
    Failed {
        receipt: DocumentOperationDispatchReceipt,
        terminal_at: String,
        error_code: String,
        detail: String,
    },
}

pub trait DocumentOperationExecutor: Send + Sync {
    fn probe(&self, profile_id: &str) -> ExecutorCapabilityReport;

    /// Must be idempotent for one manifest.dispatch_id. A repeated call returns
    /// the original receipt and may never create a second run.
    fn start(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
    ) -> Result<DocumentOperationDispatchReceipt>;

    fn inspect(&self, dispatch_id: &str) -> Result<ExecutorObservation>;

    fn cancel(&self, run_id: &str, reason: &str) -> Result<()>;
}

/// Stateless executor used by the backend-only API/CLI vertical slice.
///
/// It persists an accepted receipt but deliberately never executes or
/// completes model-generated code. A crash before the receipt is stored is
/// therefore reconciled as ambiguous instead of being silently redispatched.
#[derive(Debug, Default, Clone, Copy)]
pub struct ControlPlanePreviewExecutor;

impl DocumentOperationExecutor for ControlPlanePreviewExecutor {
    fn probe(&self, profile_id: &str) -> ExecutorCapabilityReport {
        ExecutorCapabilityReport {
            available: profile_id == CONTROL_PLANE_PREVIEW_PROFILE,
            profile_id: profile_id.to_string(),
            profile_digest: CONTROL_PLANE_PREVIEW_DIGEST.to_string(),
            executes_model_code: false,
        }
    }

    fn start(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
    ) -> Result<DocumentOperationDispatchReceipt> {
        if manifest.executor_profile != CONTROL_PLANE_PREVIEW_PROFILE {
            anyhow::bail!("control-plane preview executor does not support requested profile");
        }
        let receipt = DocumentOperationDispatchReceipt {
            dispatch_id: manifest.dispatch_id.clone(),
            run_id: format!("preview-{}", manifest.dispatch_id),
            executor_profile_digest: CONTROL_PLANE_PREVIEW_DIGEST.to_string(),
            // Derive the receipt completely from the immutable manifest so a
            // repeated start has byte-identical output.
            accepted_at: manifest.created_at.clone(),
        };
        receipt.validate_for(manifest).map_err(anyhow::Error::msg)?;
        Ok(receipt)
    }

    fn inspect(&self, _dispatch_id: &str) -> Result<ExecutorObservation> {
        Ok(ExecutorObservation::NotFound)
    }

    fn cancel(&self, _run_id: &str, _reason: &str) -> Result<()> {
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct RestrictedPageProgramExecutor {
    data_root: PathBuf,
    pipeline_command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RestrictedRunIndex {
    schema: String,
    operation_id: String,
    attempt: u32,
    dispatch_id: String,
    run_id: String,
    pid: u32,
    wall_time_seconds: u64,
    program_sha256: String,
    receipt: DocumentOperationDispatchReceipt,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct RestrictedWorkerResult {
    schema: String,
    status: String,
    #[serde(default)]
    candidate_pdf_sha256: String,
    #[serde(default)]
    program_sha256: String,
    #[serde(default)]
    visual_validation_sha256: String,
    #[serde(default)]
    error_code: String,
    #[serde(default)]
    detail: String,
}

impl RestrictedPageProgramExecutor {
    pub fn new(data_root: &Path, pipeline_command: &str) -> Self {
        Self {
            data_root: data_root.to_path_buf(),
            pipeline_command: pipeline_command.to_string(),
        }
    }

    fn runs_dir(&self) -> PathBuf {
        self.data_root.join("operations").join("runs")
    }

    fn index_path(&self, dispatch_id: &str) -> Result<PathBuf> {
        validate_operation_id(dispatch_id).map_err(anyhow::Error::msg)?;
        Ok(self.runs_dir().join(format!("{dispatch_id}.json")))
    }

    fn load_index(&self, dispatch_id: &str) -> Result<Option<RestrictedRunIndex>> {
        let path = self.index_path(dispatch_id)?;
        if !path.exists() {
            return Ok(None);
        }
        require_regular_file(&path, "executor run index")?;
        let index: RestrictedRunIndex = serde_json::from_slice(&fs::read(path)?)?;
        if index.schema != "restricted_page_program_run_v1"
            || index.dispatch_id != dispatch_id
            || index.receipt.dispatch_id != dispatch_id
            || index.receipt.run_id != index.run_id
        {
            bail!("executor run index identity is invalid");
        }
        validate_sha256_value(&index.program_sha256)?;
        Ok(Some(index))
    }

    fn paths_for_index(&self, index: &RestrictedRunIndex) -> Result<OperationWorkspacePaths> {
        validate_operation_id(&index.operation_id).map_err(anyhow::Error::msg)?;
        Ok(OperationWorkspacePaths::from_root(
            self.data_root
                .join("operations")
                .join(&index.operation_id)
                .join("attempts")
                .join(format!("{:04}", index.attempt)),
        ))
    }

    fn worker_command(&self) -> Command {
        let mut command = Command::new(&self.pipeline_command);
        command.arg("document-operation");
        command
    }
}

impl DocumentOperationExecutor for RestrictedPageProgramExecutor {
    fn probe(&self, profile_id: &str) -> ExecutorCapabilityReport {
        let worker_available = pipeline_command_is_available(&self.pipeline_command);
        ExecutorCapabilityReport {
            available: profile_id == RESTRICTED_PAGE_PROGRAM_PROFILE && worker_available,
            profile_id: profile_id.to_string(),
            profile_digest: RESTRICTED_PAGE_PROGRAM_DIGEST.to_string(),
            // The worker interprets a closed JSON grammar. It never executes
            // model-provided Python, shell, modules, paths, or environment.
            executes_model_code: false,
        }
    }

    fn start(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
    ) -> Result<DocumentOperationDispatchReceipt> {
        if manifest.executor_profile != RESTRICTED_PAGE_PROGRAM_PROFILE {
            bail!("restricted page executor does not support requested profile");
        }
        if let Some(existing) = self.load_index(&manifest.dispatch_id)? {
            existing
                .receipt
                .validate_for(manifest)
                .map_err(anyhow::Error::msg)?;
            return Ok(existing.receipt);
        }
        if !pipeline_command_is_available(&self.pipeline_command) {
            bail!(
                "restricted page executor command is unavailable: {}",
                self.pipeline_command
            );
        }
        let paths = OperationWorkspacePaths::for_manifest(&self.data_root, manifest);
        require_regular_file(&paths.source_pdf, "operation source PDF")?;
        require_regular_file(&paths.program_json, "operation page program")?;
        require_regular_file(&paths.limits_json, "operation limits")?;
        if sha256_file(&paths.source_pdf)? != manifest.source_pdf_sha256
            || sha256_file(&paths.program_json)? != manifest.program_sha256
        {
            bail!("operation workspace hash check failed before dispatch");
        }
        let stdout = open_log(&paths.stdout_log)?;
        let stderr = open_log(&paths.stderr_log)?;
        let mut command = self.worker_command();
        command
            .arg("--source")
            .arg(&paths.source_pdf)
            .arg("--program")
            .arg(&paths.program_json)
            .arg("--output")
            .arg(&paths.candidate_pdf)
            .arg("--result")
            .arg(&paths.result_json)
            .arg("--visual-validation")
            .arg(&paths.visual_validation_json)
            .arg("--limits")
            .arg(&paths.limits_json)
            .current_dir(&paths.root)
            .env_clear()
            .env("PATH", std::env::var("PATH").unwrap_or_default())
            .env("PYTHONNOUSERSITE", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr));
        configure_process_group(&mut command);
        let mut child = command.spawn().with_context(|| {
            format!(
                "failed to start restricted page executor via {}",
                self.pipeline_command.clone(),
            )
        })?;
        let receipt = DocumentOperationDispatchReceipt {
            dispatch_id: manifest.dispatch_id.clone(),
            run_id: manifest.dispatch_id.replacen("dispatch-", "run-", 1),
            executor_profile_digest: RESTRICTED_PAGE_PROGRAM_DIGEST.to_string(),
            accepted_at: now_iso(),
        };
        receipt.validate_for(manifest).map_err(anyhow::Error::msg)?;
        let index = RestrictedRunIndex {
            schema: "restricted_page_program_run_v1".to_string(),
            operation_id: manifest.operation_id.clone(),
            attempt: manifest.attempt,
            dispatch_id: manifest.dispatch_id.clone(),
            run_id: receipt.run_id.clone(),
            pid: child.id(),
            wall_time_seconds: manifest.limits.wall_time_seconds,
            program_sha256: manifest.program_sha256.clone(),
            receipt: receipt.clone(),
        };
        if let Err(error) = write_json_create_new(&self.index_path(&manifest.dispatch_id)?, &index)
        {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        thread::spawn(move || {
            let _ = child.wait();
        });
        Ok(receipt)
    }

    fn inspect(&self, dispatch_id: &str) -> Result<ExecutorObservation> {
        let Some(index) = self.load_index(dispatch_id)? else {
            return Ok(ExecutorObservation::NotFound);
        };
        let paths = self.paths_for_index(&index)?;
        if paths.result_json.exists() {
            require_regular_file(&paths.result_json, "executor terminal result")?;
            let result: RestrictedWorkerResult =
                serde_json::from_slice(&fs::read(&paths.result_json)?)?;
            if result.schema != "retainpdf_page_program_result_v1" {
                bail!("executor returned an unsupported terminal result");
            }
            return match result.status.as_str() {
                "completed" => {
                    if result.program_sha256 != index.program_sha256 {
                        return Ok(ExecutorObservation::Failed {
                            receipt: index.receipt,
                            terminal_at: now_iso(),
                            error_code: "executor_program_identity_mismatch".to_string(),
                            detail: "executor result does not match the immutable page program"
                                .to_string(),
                        });
                    }
                    validate_sha256_value(&result.candidate_pdf_sha256)?;
                    if validate_sha256_value(&result.visual_validation_sha256).is_err() {
                        return Ok(ExecutorObservation::Failed {
                            receipt: index.receipt,
                            terminal_at: now_iso(),
                            error_code: "executor_visual_validation_missing".to_string(),
                            detail: "executor result has no immutable raster validation identity"
                                .to_string(),
                        });
                    }
                    Ok(ExecutorObservation::Completed {
                        receipt: index.receipt,
                        terminal_at: now_iso(),
                        candidate_pdf_sha256: result.candidate_pdf_sha256,
                    })
                }
                "cancelled" => Ok(ExecutorObservation::Cancelled {
                    receipt: index.receipt,
                    terminal_at: now_iso(),
                }),
                _ => Ok(ExecutorObservation::Failed {
                    receipt: index.receipt,
                    terminal_at: now_iso(),
                    error_code: non_empty_or(&result.error_code, "page_program_failed"),
                    detail: sanitize_executor_detail(&result.detail, &paths.root, &self.data_root),
                }),
            };
        }
        if let Ok(accepted_at) = DateTime::parse_from_rfc3339(&index.receipt.accepted_at) {
            let deadline = accepted_at.with_timezone(&Utc)
                + Duration::seconds(index.wall_time_seconds.min(i64::MAX as u64) as i64);
            if Utc::now() > deadline {
                if retain_proc::worker_process_exists(index.pid) {
                    retain_proc::terminate_job_process_tree_blocking(index.pid, 2, 50)?;
                }
                return Ok(ExecutorObservation::Failed {
                    receipt: index.receipt,
                    terminal_at: now_iso(),
                    error_code: "executor_wall_timeout".to_string(),
                    detail: "restricted page executor exceeded its wall-time limit".to_string(),
                });
            }
        }
        if retain_proc::worker_process_exists(index.pid) {
            return Ok(ExecutorObservation::Accepted(index.receipt));
        }
        Ok(ExecutorObservation::Failed {
            receipt: index.receipt,
            terminal_at: now_iso(),
            error_code: "executor_process_missing".to_string(),
            detail: "restricted page executor exited without a terminal result".to_string(),
        })
    }

    fn cancel(&self, run_id: &str, reason: &str) -> Result<()> {
        validate_operation_id(run_id).map_err(anyhow::Error::msg)?;
        let Some(suffix) = run_id.strip_prefix("run-") else {
            bail!("restricted executor run id is invalid");
        };
        let dispatch_id = format!("dispatch-{suffix}");
        let Some(index) = self.load_index(&dispatch_id)? else {
            return Ok(());
        };
        if retain_proc::worker_process_exists(index.pid) {
            retain_proc::terminate_job_process_tree_blocking(index.pid, 2, 50)?;
        }
        let paths = self.paths_for_index(&index)?;
        if !paths.result_json.exists() {
            write_json_create_new(
                &paths.result_json,
                &RestrictedWorkerResult {
                    schema: "retainpdf_page_program_result_v1".to_string(),
                    status: "cancelled".to_string(),
                    candidate_pdf_sha256: String::new(),
                    program_sha256: String::new(),
                    visual_validation_sha256: String::new(),
                    error_code: "cancelled".to_string(),
                    detail: reason.trim().chars().take(1000).collect(),
                },
            )?;
        }
        Ok(())
    }
}

fn non_empty_or(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.chars().take(2000).collect()
    }
}

fn sanitize_executor_detail(value: &str, workspace: &Path, data_root: &Path) -> String {
    let safe = non_empty_or(value, "restricted page executor failed")
        .replace(&workspace.to_string_lossy().to_string(), "[WORKSPACE]")
        .replace(&data_root.to_string_lossy().to_string(), "[DATA_ROOT]");
    safe.chars().take(2000).collect()
}

fn validate_sha256_value(value: &str) -> Result<()> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("executor returned an invalid candidate PDF hash");
    }
    Ok(())
}

fn open_log(path: &Path) -> Result<fs::File> {
    if path.exists() {
        require_regular_file(path, "executor log")?;
    }
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path).map_err(Into::into)
}

fn write_json_create_new<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
        set_private_directory_mode(parent)?;
    }
    let encoded = serde_json::to_vec(value)?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| anyhow::anyhow!("executor journal path has no filename"))?;
    let temporary = path.with_file_name(format!(
        ".{file_name}.{}-{}.tmp",
        std::process::id(),
        fastrand::u64(..)
    ));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let result = (|| -> Result<()> {
        let mut file = options.open(&temporary)?;
        use std::io::Write;
        file.write_all(&encoded)?;
        file.sync_all()?;
        // Linking a fully synced temporary inode publishes the journal with
        // create-new semantics: a crash cannot leave a truncated target, and
        // a competing writer cannot overwrite an accepted dispatch/result.
        fs::hard_link(&temporary, path)?;
        let _ = fs::remove_file(&temporary);
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(unix)]
fn set_private_directory_mode(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_directory_mode(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
fn configure_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;

    command.process_group(0);
}

#[cfg(not(unix))]
fn configure_process_group(_command: &mut Command) {}

#[cfg(all(test, unix))]
mod restricted_tests {
    use retain_core::models::domain::{
        DocumentOperationLimits, DocumentOperationStatus, DocumentOperationWorkspaceState,
        DOCUMENT_OPERATION_MANIFEST_SCHEMA, DOCUMENT_OPERATION_SCHEMA_VERSION,
        DOCUMENT_OPERATION_STATE_SCHEMA,
    };
    use serde_json::json;

    use super::*;
    use crate::services::document_operations::program::canonical_program_sha256;
    use crate::services::document_operations::workspace::materialize_operation_workspace;

    #[test]
    fn restricted_executor_uses_pipeline_subcommand() {
        let executor = RestrictedPageProgramExecutor::new(
            Path::new("/tmp/data"),
            "/opt/retainpdf/bin/retainpdf-pipeline",
        );
        let command = executor.worker_command();

        assert_eq!(
            command.get_program(),
            std::ffi::OsStr::new("/opt/retainpdf/bin/retainpdf-pipeline")
        );
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            vec![std::ffi::OsStr::new("document-operation")]
        );
    }

    #[test]
    fn restricted_executor_cancel_kills_process_group_and_persists_terminal_result() {
        let root = std::env::temp_dir().join(format!(
            "retainpdf-restricted-executor-cancel-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        let bin_dir = root.join("bin");
        fs::create_dir_all(&bin_dir).expect("bin dir");
        let stub = bin_dir.join("retainpdf-pipeline");
        fs::write(&stub, "#!/bin/sh\nsleep 30\n").expect("stub pipeline command");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&stub, fs::Permissions::from_mode(0o700))
                .expect("make stub executable");
        }
        let source = root.join("source.pdf");
        fs::write(&source, b"%PDF-1.4\n%%EOF\n").expect("source");
        let program = json!({
            "schema": "retainpdf_page_program_v1",
            "steps": [{"op": "select_pages", "pages": [1]}]
        });
        let manifest = DocumentOperationWorkspaceManifest {
            schema: DOCUMENT_OPERATION_MANIFEST_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: "op-cancel-restricted".to_string(),
            attempt: 1,
            dispatch_id: "dispatch-cancel-restricted".to_string(),
            document_id: "a".repeat(64),
            base_job_id: "job-a".to_string(),
            conversation_id: String::new(),
            request_message_id: "message-a".to_string(),
            intent_summary: "cancel test".to_string(),
            source_pdf_sha256: sha256_file(&source).expect("source hash"),
            normalized_document_sha256: None,
            program_sha256: canonical_program_sha256(&program).expect("program hash"),
            executor_profile: RESTRICTED_PAGE_PROGRAM_PROFILE.to_string(),
            limits: DocumentOperationLimits {
                wall_time_seconds: 30,
                cpu_time_seconds: 10,
                memory_bytes: 128 * 1024 * 1024,
                scratch_bytes: 16 * 1024 * 1024,
                output_bytes: 16 * 1024 * 1024,
                process_count: 1,
                file_descriptor_count: 16,
                file_count: 8,
                stdout_bytes: 1024,
                stderr_bytes: 1024,
            },
            created_at: now_iso(),
        };
        let state = DocumentOperationWorkspaceState {
            schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: manifest.operation_id.clone(),
            attempt: 1,
            dispatch_id: manifest.dispatch_id.clone(),
            program_sha256: manifest.program_sha256.clone(),
            status: DocumentOperationStatus::Draft,
            dispatch_intent_at: None,
            dispatch_receipt: None,
            terminal_receipt_at: None,
            candidate_pdf_sha256: None,
            error_code: None,
            detail: None,
            updated_at: now_iso(),
        };
        materialize_operation_workspace(&data_root, &source, &program, &manifest, &state)
            .expect("workspace");
        let executor =
            RestrictedPageProgramExecutor::new(&data_root, &stub.to_string_lossy());
        let receipt = executor.start(&manifest).expect("start worker");
        assert!(retain_proc::worker_process_exists(
            executor
                .load_index(&manifest.dispatch_id)
                .expect("index")
                .expect("run")
                .pid
        ));
        executor
            .cancel(&receipt.run_id, "test_cancel")
            .expect("cancel");
        assert!(matches!(
            executor.inspect(&manifest.dispatch_id).expect("inspect"),
            ExecutorObservation::Cancelled { .. }
        ));
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(test)]
// Keep the platform-specific real-process test beside the process helpers;
// this shared deterministic executor remains available to the parent tests.
#[allow(clippy::items_after_test_module)]
mod deterministic {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use anyhow::{bail, Result};
    use retain_core::models::domain::{now_iso, DocumentOperationDispatchReceipt};

    use super::*;

    const PROFILE_ID: &str = "deterministic_test_v1";
    const PROFILE_DIGEST: &str = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

    #[derive(Debug, Clone)]
    enum RunState {
        Accepted(DocumentOperationDispatchReceipt),
        Completed {
            receipt: DocumentOperationDispatchReceipt,
            terminal_at: String,
            candidate_pdf_sha256: String,
        },
        Cancelled {
            receipt: DocumentOperationDispatchReceipt,
            terminal_at: String,
        },
    }

    #[derive(Default)]
    struct Inner {
        runs: HashMap<String, RunState>,
        start_calls: usize,
        created_runs: usize,
    }

    #[derive(Default)]
    pub(crate) struct DeterministicExecutor {
        inner: Mutex<Inner>,
    }

    impl DeterministicExecutor {
        pub(crate) fn start_calls(&self) -> usize {
            self.inner
                .lock()
                .expect("deterministic executor mutex")
                .start_calls
        }

        pub(crate) fn created_runs(&self) -> usize {
            self.inner
                .lock()
                .expect("deterministic executor mutex")
                .created_runs
        }

        pub(crate) fn complete(&self, dispatch_id: &str, candidate_pdf_sha256: &str) {
            let mut inner = self.inner.lock().expect("deterministic executor mutex");
            let Some(RunState::Accepted(receipt)) = inner.runs.get(dispatch_id).cloned() else {
                panic!("dispatch must be accepted before completion");
            };
            inner.runs.insert(
                dispatch_id.to_string(),
                RunState::Completed {
                    receipt,
                    terminal_at: now_iso(),
                    candidate_pdf_sha256: candidate_pdf_sha256.to_string(),
                },
            );
        }
    }

    impl DocumentOperationExecutor for DeterministicExecutor {
        fn probe(&self, profile_id: &str) -> ExecutorCapabilityReport {
            ExecutorCapabilityReport {
                available: profile_id == PROFILE_ID,
                profile_id: profile_id.to_string(),
                profile_digest: PROFILE_DIGEST.to_string(),
                executes_model_code: false,
            }
        }

        fn start(
            &self,
            manifest: &DocumentOperationWorkspaceManifest,
        ) -> Result<DocumentOperationDispatchReceipt> {
            if manifest.executor_profile != PROFILE_ID {
                bail!("deterministic executor does not support requested profile");
            }
            let mut inner = self.inner.lock().expect("deterministic executor mutex");
            inner.start_calls += 1;
            if let Some(existing) = inner.runs.get(&manifest.dispatch_id) {
                return Ok(match existing {
                    RunState::Accepted(receipt)
                    | RunState::Completed { receipt, .. }
                    | RunState::Cancelled { receipt, .. } => receipt.clone(),
                });
            }
            let receipt = DocumentOperationDispatchReceipt {
                dispatch_id: manifest.dispatch_id.clone(),
                run_id: format!("run-{}", manifest.dispatch_id),
                executor_profile_digest: PROFILE_DIGEST.to_string(),
                accepted_at: now_iso(),
            };
            receipt.validate_for(manifest).map_err(anyhow::Error::msg)?;
            inner.created_runs += 1;
            inner.runs.insert(
                manifest.dispatch_id.clone(),
                RunState::Accepted(receipt.clone()),
            );
            Ok(receipt)
        }

        fn inspect(&self, dispatch_id: &str) -> Result<ExecutorObservation> {
            let inner = self.inner.lock().expect("deterministic executor mutex");
            Ok(match inner.runs.get(dispatch_id) {
                None => ExecutorObservation::NotFound,
                Some(RunState::Accepted(receipt)) => ExecutorObservation::Accepted(receipt.clone()),
                Some(RunState::Completed {
                    receipt,
                    terminal_at,
                    candidate_pdf_sha256,
                }) => ExecutorObservation::Completed {
                    receipt: receipt.clone(),
                    terminal_at: terminal_at.clone(),
                    candidate_pdf_sha256: candidate_pdf_sha256.clone(),
                },
                Some(RunState::Cancelled {
                    receipt,
                    terminal_at,
                }) => ExecutorObservation::Cancelled {
                    receipt: receipt.clone(),
                    terminal_at: terminal_at.clone(),
                },
            })
        }

        fn cancel(&self, run_id: &str, _reason: &str) -> Result<()> {
            let mut inner = self.inner.lock().expect("deterministic executor mutex");
            let Some((dispatch_id, state)) = inner
                .runs
                .iter()
                .find(|(_, state)| match state {
                    RunState::Accepted(receipt)
                    | RunState::Completed { receipt, .. }
                    | RunState::Cancelled { receipt, .. } => receipt.run_id == run_id,
                })
                .map(|(dispatch_id, state)| (dispatch_id.clone(), state.clone()))
            else {
                return Ok(());
            };
            let receipt = match state {
                RunState::Accepted(receipt)
                | RunState::Completed { receipt, .. }
                | RunState::Cancelled { receipt, .. } => receipt,
            };
            inner.runs.insert(
                dispatch_id,
                RunState::Cancelled {
                    receipt,
                    terminal_at: now_iso(),
                },
            );
            Ok(())
        }
    }
}

#[cfg(test)]
pub(crate) use deterministic::DeterministicExecutor;
