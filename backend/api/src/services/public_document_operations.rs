use std::collections::BTreeSet;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

use retain_core::models::domain::{validate_operation_id, DocumentOperationStatus};
use retain_core::storage_paths::resolve_data_path;
use retain_data::db::Db;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::config::AppConfig;
use crate::error::AppError;

use super::document_operations::{
    cancel_document_operation, commit_document_operation, get_document_operation_view,
    run_document_operation, CancelDocumentOperationInput, CommitDocumentOperationInput,
    DocumentOperationView, OperationWorkspacePaths, RetainPdfPageProgram, RetainPdfPageProgramStep,
    RunDocumentOperationInput, DOCUMENT_OPERATION_CANCEL_INPUT_SCHEMA,
    DOCUMENT_OPERATION_COMMIT_INPUT_SCHEMA, DOCUMENT_OPERATION_RUN_INPUT_SCHEMA,
    RESTRICTED_PAGE_PROGRAM_PROFILE,
};

pub const PUBLIC_DOCUMENT_OPERATION_ACTION_SCHEMA: &str = "document_operation_action_v1";
pub const PUBLIC_DOCUMENT_OPERATION_VIEW_SCHEMA: &str = "public_document_operation_v1";

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct PublicDocumentOperationListQuery {
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicDocumentOperationActionInput {
    pub schema: String,
    pub idempotency_key: String,
    pub expected_status: DocumentOperationStatus,
    pub expected_attempt: u32,
    pub expected_program_sha256: String,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub accept_duplicate_risk: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationListView {
    pub operations: Vec<PublicDocumentOperationView>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct DocumentAgentVersionListQuery {
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentAgentVersionView {
    pub version_id: String,
    pub document_id: String,
    pub base_version_id: Option<String>,
    pub operation_id: String,
    pub status: String,
    pub is_active: bool,
    pub content_sha256: String,
    pub created_at: String,
    pub committed_at: Option<String>,
    pub download_path: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentAgentVersionListView {
    pub versions: Vec<DocumentAgentVersionView>,
    pub active_version_id: Option<String>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationEventView {
    pub seq: u64,
    pub attempt: u32,
    pub ts: String,
    pub event: String,
    pub status: DocumentOperationStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationCandidateView {
    pub version_id: String,
    pub status: String,
    pub content_sha256: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationFailureView {
    pub code: &'static str,
    pub message: &'static str,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationPlanStepView {
    pub op: &'static str,
    pub pages: Vec<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub degrees: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicDocumentOperationView {
    pub schema: &'static str,
    pub operation_id: String,
    pub conversation_id: Option<String>,
    pub request_message_id: String,
    pub document_id: String,
    pub intent_summary: String,
    pub plan_steps: Vec<PublicDocumentOperationPlanStepView>,
    pub affected_pages: Vec<u32>,
    pub status: DocumentOperationStatus,
    pub current_attempt: u32,
    pub program_sha256: String,
    pub candidate_available: bool,
    pub candidate: Option<PublicDocumentOperationCandidateView>,
    pub failure: Option<PublicDocumentOperationFailureView>,
    pub latest_event_seq: u64,
    pub allowed_actions: Vec<&'static str>,
    pub events: Vec<PublicDocumentOperationEventView>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct PublicDocumentOperationCandidateDownload {
    pub path: PathBuf,
}

pub fn list_public_document_operations(
    db: &Db,
    config: &AppConfig,
    conversation_id: &str,
    query: &PublicDocumentOperationListQuery,
) -> Result<PublicDocumentOperationListView, AppError> {
    let conversation_id = conversation_id.trim();
    if conversation_id.is_empty() {
        return Err(AppError::bad_request("conversation_id is required"));
    }
    if db
        .get_conversation(conversation_id)
        .map_err(internal_error)?
        .is_none()
    {
        return Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        )));
    }
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let total = db
        .count_document_operations_for_conversation(conversation_id)
        .map_err(internal_error)?;
    let operations = db
        .list_document_operations_for_conversation(conversation_id, limit, query.offset)
        .map_err(internal_error)?;
    let returned = operations.len() as u64;
    let mut views = Vec::with_capacity(operations.len());
    for operation in operations {
        views.push(get_public_document_operation(
            db,
            config,
            &operation.operation_id,
        )?);
    }
    Ok(PublicDocumentOperationListView {
        operations: views,
        total,
        limit,
        offset: query.offset,
        has_more: u64::from(query.offset).saturating_add(returned) < total,
    })
}

pub fn list_document_agent_versions(
    db: &Db,
    document_id: &str,
    query: &DocumentAgentVersionListQuery,
    base_url: &str,
) -> Result<DocumentAgentVersionListView, AppError> {
    let document_id = document_id.trim();
    if document_id.is_empty() {
        return Err(AppError::bad_request("document_id is required"));
    }
    db.get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let total = db
        .count_document_versions(document_id)
        .map_err(internal_error)?;
    let active_version_id = db
        .get_active_document_version_id(document_id)
        .map_err(internal_error)?;
    let records = db
        .list_document_versions(document_id, limit, query.offset)
        .map_err(internal_error)?;
    let returned = records.len() as u64;
    let versions = records
        .into_iter()
        .map(|version| {
            let download_path = format!(
                "/api/v1/ai/operations/{}/candidate.pdf",
                version.operation_id
            );
            DocumentAgentVersionView {
                is_active: active_version_id.as_deref() == Some(version.version_id.as_str()),
                version_id: version.version_id,
                document_id: version.document_id,
                base_version_id: version.base_version_id,
                operation_id: version.operation_id,
                status: version.status,
                content_sha256: version.content_sha256,
                created_at: version.created_at,
                committed_at: version.committed_at,
                download_url: format!("{}{}", base_url.trim_end_matches('/'), download_path),
                download_path,
            }
        })
        .collect();
    Ok(DocumentAgentVersionListView {
        versions,
        active_version_id,
        total,
        limit,
        offset: query.offset,
        has_more: u64::from(query.offset).saturating_add(returned) < total,
    })
}

pub fn get_public_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
) -> Result<PublicDocumentOperationView, AppError> {
    let view = get_document_operation_view(db, config, operation_id, false)?;
    Ok(project_public_view(config, view))
}

pub fn run_public_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &PublicDocumentOperationActionInput,
) -> Result<PublicDocumentOperationView, AppError> {
    validate_action_input(input)?;
    require_action_preconditions(db, config, operation_id, input, PublicAction::Run)?;
    let view = run_document_operation(
        db,
        config,
        operation_id,
        &RunDocumentOperationInput {
            schema: DOCUMENT_OPERATION_RUN_INPUT_SCHEMA.to_string(),
            idempotency_key: input.idempotency_key.clone(),
            confirmed: true,
            retry: false,
            accept_duplicate_risk: false,
        },
    )?;
    Ok(project_public_view(config, view))
}

pub fn retry_public_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &PublicDocumentOperationActionInput,
) -> Result<PublicDocumentOperationView, AppError> {
    validate_action_input(input)?;
    require_action_preconditions(db, config, operation_id, input, PublicAction::Retry)?;
    let view = run_document_operation(
        db,
        config,
        operation_id,
        &RunDocumentOperationInput {
            schema: DOCUMENT_OPERATION_RUN_INPUT_SCHEMA.to_string(),
            idempotency_key: input.idempotency_key.clone(),
            confirmed: true,
            retry: true,
            accept_duplicate_risk: input.accept_duplicate_risk,
        },
    )?;
    Ok(project_public_view(config, view))
}

pub fn cancel_public_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &PublicDocumentOperationActionInput,
) -> Result<PublicDocumentOperationView, AppError> {
    validate_action_input(input)?;
    require_action_preconditions(db, config, operation_id, input, PublicAction::Cancel)?;
    let view = cancel_document_operation(
        db,
        config,
        operation_id,
        &CancelDocumentOperationInput {
            schema: DOCUMENT_OPERATION_CANCEL_INPUT_SCHEMA.to_string(),
            idempotency_key: input.idempotency_key.clone(),
            reason: input.reason.clone(),
        },
    )?;
    Ok(project_public_view(config, view))
}

pub fn commit_public_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &PublicDocumentOperationActionInput,
) -> Result<PublicDocumentOperationView, AppError> {
    validate_action_input(input)?;
    require_action_preconditions(db, config, operation_id, input, PublicAction::Commit)?;
    let view = commit_document_operation(
        db,
        config,
        operation_id,
        &CommitDocumentOperationInput {
            schema: DOCUMENT_OPERATION_COMMIT_INPUT_SCHEMA.to_string(),
            idempotency_key: input.idempotency_key.clone(),
        },
    )?;
    Ok(project_public_view(config, view))
}

pub fn public_document_operation_candidate_download(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
) -> Result<PublicDocumentOperationCandidateDownload, AppError> {
    validate_operation_id(operation_id).map_err(AppError::bad_request)?;
    let view = get_document_operation_view(db, config, operation_id, false)?;
    if !matches!(
        view.status,
        DocumentOperationStatus::ResultReady | DocumentOperationStatus::Committed
    ) {
        return Err(AppError::conflict(format!(
            "document operation candidate is unavailable from status {}",
            view.status.as_str()
        )));
    }
    let candidate = view
        .candidate_version
        .ok_or_else(|| AppError::conflict("document operation candidate is missing"))?;
    let expected_candidate_status = if view.status == DocumentOperationStatus::Committed {
        "committed"
    } else {
        "candidate"
    };
    if candidate.operation_id != view.operation_id
        || candidate.document_id != view.document_id
        || candidate.status != expected_candidate_status
        || view.state.candidate_pdf_sha256.as_deref() != Some(&candidate.content_sha256)
    {
        return Err(AppError::conflict(
            "document operation candidate identity is inconsistent",
        ));
    }

    let path = resolve_data_path(&config.data_root, &candidate.artifact_key)
        .map_err(|error| AppError::conflict(format!("invalid candidate path: {error}")))?;
    require_regular_non_symlink(&path)?;
    let canonical_root = config.data_root.canonicalize().map_err(internal_error)?;
    let canonical_path = path.canonicalize().map_err(internal_error)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(AppError::conflict(
            "document operation candidate is outside the backend data root",
        ));
    }
    let expected_path = config
        .data_root
        .join("operations")
        .join(&view.operation_id)
        .join("attempts")
        .join(format!("{:04}", view.current_attempt))
        .join("outputs")
        .join("candidate.pdf")
        .canonicalize()
        .map_err(internal_error)?;
    if canonical_path != expected_path {
        return Err(AppError::conflict(
            "document operation candidate path does not match the active attempt",
        ));
    }
    let actual_sha256 = sha256_file(&canonical_path)?;
    if actual_sha256 != candidate.content_sha256 {
        return Err(AppError::conflict(
            "document operation candidate hash no longer matches the validated version",
        ));
    }
    Ok(PublicDocumentOperationCandidateDownload {
        path: canonical_path,
    })
}

fn validate_action_input(input: &PublicDocumentOperationActionInput) -> Result<(), AppError> {
    if input.schema != PUBLIC_DOCUMENT_OPERATION_ACTION_SCHEMA {
        return Err(AppError::bad_request(format!(
            "unsupported public document operation action schema: {}",
            input.schema
        )));
    }
    let idempotency_key = input.idempotency_key.trim();
    if idempotency_key.is_empty()
        || idempotency_key.len() > 128
        || idempotency_key.chars().any(char::is_whitespace)
    {
        return Err(AppError::bad_request(
            "idempotency_key must be 1..128 non-whitespace characters",
        ));
    }
    if input.expected_attempt == 0 {
        return Err(AppError::bad_request("expected_attempt must be positive"));
    }
    if input.expected_program_sha256.len() != 64
        || !input
            .expected_program_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(AppError::bad_request(
            "expected_program_sha256 must be a 64-character hexadecimal SHA-256",
        ));
    }
    Ok(())
}

fn require_action_preconditions(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &PublicDocumentOperationActionInput,
    action: PublicAction,
) -> Result<(), AppError> {
    let current = get_document_operation_view(db, config, operation_id, false)?;
    let safe_replay = action.is_safe_replay(db, operation_id, input, &current)?;
    if current.status != input.expected_status && !safe_replay {
        return Err(AppError::conflict(format!(
            "document operation status changed: expected {}, current {}",
            input.expected_status.as_str(),
            current.status.as_str()
        )));
    }
    if current.current_attempt != input.expected_attempt && !safe_replay {
        return Err(AppError::conflict(format!(
            "document operation attempt changed: expected {}, current {}",
            input.expected_attempt, current.current_attempt
        )));
    }
    if !current
        .manifest
        .program_sha256
        .eq_ignore_ascii_case(&input.expected_program_sha256)
    {
        return Err(AppError::conflict(
            "document operation program hash changed",
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy)]
enum PublicAction {
    Run,
    Retry,
    Cancel,
    Commit,
}

impl PublicAction {
    fn is_safe_replay(
        self,
        db: &Db,
        operation_id: &str,
        input: &PublicDocumentOperationActionInput,
        current: &DocumentOperationView,
    ) -> Result<bool, AppError> {
        if !matches!(self, Self::Retry) && current.current_attempt != input.expected_attempt {
            return Ok(false);
        }
        match self {
            Self::Run => Ok(matches!(
                input.expected_status,
                DocumentOperationStatus::Draft | DocumentOperationStatus::AwaitingConfirmation
            ) && matches!(
                current.status,
                DocumentOperationStatus::Queued
                    | DocumentOperationStatus::Running
                    | DocumentOperationStatus::Validating
                    | DocumentOperationStatus::ResultReady
                    | DocumentOperationStatus::Committed
            )),
            Self::Cancel => Ok(current.status == DocumentOperationStatus::Cancelled),
            Self::Commit => Ok(current.status == DocumentOperationStatus::Committed),
            Self::Retry => {
                if !matches!(
                    input.expected_status,
                    DocumentOperationStatus::Failed | DocumentOperationStatus::Ambiguous
                ) {
                    return Ok(false);
                }
                let retry = db
                    .get_document_operation_attempt_by_retry_key(
                        operation_id,
                        &input.idempotency_key,
                    )
                    .map_err(internal_error)?;
                Ok(retry.is_some_and(|attempt| {
                    attempt.manifest.attempt == input.expected_attempt.saturating_add(1)
                        && attempt
                            .manifest
                            .program_sha256
                            .eq_ignore_ascii_case(&input.expected_program_sha256)
                }))
            }
        }
    }
}

fn project_public_view(
    config: &AppConfig,
    view: DocumentOperationView,
) -> PublicDocumentOperationView {
    let (plan_steps, affected_pages) = public_operation_plan(config, &view);
    let failure = public_failure_view(&view.status, view.state.error_code.as_deref());
    let latest_event_seq = view.events.last().map(|event| event.seq).unwrap_or(0);
    let candidate_available = view.candidate_version.is_some()
        && matches!(
            view.status,
            DocumentOperationStatus::ResultReady | DocumentOperationStatus::Committed
        );
    let candidate = candidate_available.then(|| {
        let candidate = view
            .candidate_version
            .as_ref()
            .expect("candidate availability was checked");
        PublicDocumentOperationCandidateView {
            version_id: candidate.version_id.clone(),
            status: candidate.status.clone(),
            content_sha256: candidate.content_sha256.clone(),
            url: format!("/api/v1/ai/operations/{}/candidate.pdf", view.operation_id),
        }
    });
    let events = view
        .events
        .into_iter()
        .map(|event| PublicDocumentOperationEventView {
            seq: event.seq,
            attempt: event.attempt,
            ts: event.ts,
            event: event.event,
            status: event.status,
        })
        .collect();
    PublicDocumentOperationView {
        schema: PUBLIC_DOCUMENT_OPERATION_VIEW_SCHEMA,
        operation_id: view.operation_id,
        conversation_id: view.conversation_id,
        request_message_id: view.request_message_id,
        document_id: view.document_id,
        intent_summary: view.intent_summary,
        plan_steps,
        affected_pages,
        status: view.status.clone(),
        current_attempt: view.current_attempt,
        program_sha256: view.manifest.program_sha256,
        candidate_available,
        candidate,
        failure,
        latest_event_seq,
        allowed_actions: allowed_actions(&view.status),
        events,
        created_at: view.created_at,
        updated_at: view.updated_at,
    }
}

fn public_failure_view(
    status: &DocumentOperationStatus,
    error_code: Option<&str>,
) -> Option<PublicDocumentOperationFailureView> {
    if !matches!(
        status,
        DocumentOperationStatus::Failed | DocumentOperationStatus::Ambiguous
    ) {
        return None;
    }
    let retryable = true;
    let (code, message) = match error_code.unwrap_or_default() {
        "page_program_failed" => ("page_program_failed", "PDF 页面操作或视觉一致性校验失败。"),
        "candidate_validation_failed" => (
            "candidate_validation_failed",
            "候选 PDF 未通过后端完整性校验。",
        ),
        "executor_program_identity_mismatch" => (
            "executor_program_identity_mismatch",
            "执行结果与已批准的页面程序不一致。",
        ),
        "executor_visual_validation_missing" => (
            "executor_visual_validation_missing",
            "执行器没有生成必需的视觉校验报告。",
        ),
        "executor_wall_timeout" => ("executor_wall_timeout", "PDF 操作执行超时。"),
        "executor_process_missing" => ("executor_process_missing", "PDF 操作执行进程不可用。"),
        "executor_receipt_missing" => ("executor_receipt_missing", "PDF 操作执行回执缺失。"),
        "dispatch_outcome_unknown" => (
            "dispatch_outcome_unknown",
            "执行结果未知；重试前需要确认重复执行风险。",
        ),
        _ => ("document_operation_failed", "PDF 操作执行失败。"),
    };
    Some(PublicDocumentOperationFailureView {
        code,
        message,
        retryable,
    })
}

fn public_operation_plan(
    config: &AppConfig,
    view: &DocumentOperationView,
) -> (Vec<PublicDocumentOperationPlanStepView>, Vec<u32>) {
    if view.manifest.executor_profile != RESTRICTED_PAGE_PROGRAM_PROFILE {
        return (Vec::new(), Vec::new());
    }
    let path =
        OperationWorkspacePaths::for_manifest(&config.data_root, &view.manifest).program_json;
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return (Vec::new(), Vec::new());
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() > 256 * 1024 {
        return (Vec::new(), Vec::new());
    }
    let Ok(bytes) = fs::read(&path) else {
        return (Vec::new(), Vec::new());
    };
    let digest = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if !digest.eq_ignore_ascii_case(&view.manifest.program_sha256) {
        return (Vec::new(), Vec::new());
    }
    let Ok(value) = serde_json::from_slice(&bytes) else {
        return (Vec::new(), Vec::new());
    };
    let Ok(program) = RetainPdfPageProgram::from_value(&value) else {
        return (Vec::new(), Vec::new());
    };
    let mut affected_pages = BTreeSet::new();
    let plan_steps = program
        .steps
        .into_iter()
        .map(|step| match step {
            RetainPdfPageProgramStep::SelectPages { pages } => {
                affected_pages.extend(pages.iter().copied());
                PublicDocumentOperationPlanStepView {
                    op: "select_pages",
                    pages,
                    degrees: None,
                }
            }
            RetainPdfPageProgramStep::RotatePages { pages, degrees } => {
                affected_pages.extend(pages.iter().copied());
                PublicDocumentOperationPlanStepView {
                    op: "rotate_pages",
                    pages,
                    degrees: Some(degrees),
                }
            }
        })
        .collect();
    (plan_steps, affected_pages.into_iter().collect())
}

fn allowed_actions(status: &DocumentOperationStatus) -> Vec<&'static str> {
    match status {
        DocumentOperationStatus::Draft | DocumentOperationStatus::AwaitingConfirmation => {
            vec!["run", "cancel"]
        }
        DocumentOperationStatus::Queued
        | DocumentOperationStatus::Running
        | DocumentOperationStatus::Validating => vec!["cancel"],
        DocumentOperationStatus::ResultReady => vec!["commit", "cancel"],
        DocumentOperationStatus::Failed | DocumentOperationStatus::Ambiguous => vec!["retry"],
        DocumentOperationStatus::Committed | DocumentOperationStatus::Cancelled => Vec::new(),
    }
}

fn require_regular_non_symlink(path: &std::path::Path) -> Result<(), AppError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| AppError::not_found("document operation candidate file is missing"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AppError::conflict(
            "document operation candidate must be a regular non-symlink file",
        ));
    }
    Ok(())
}

fn sha256_file(path: &std::path::Path) -> Result<String, AppError> {
    let mut file = fs::File::open(path).map_err(internal_error)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(internal_error)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn internal_error(error: impl std::fmt::Display) -> AppError {
    AppError::internal(error.to_string())
}
