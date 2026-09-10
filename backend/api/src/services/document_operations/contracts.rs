use retain_core::models::domain::{
    DocumentOperationLimits, DocumentOperationStatus, DocumentOperationWorkspaceManifest,
    DocumentOperationWorkspaceState,
};
use retain_data::db::DocumentVersionRecord;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const DOCUMENT_OPERATION_CREATE_INPUT_SCHEMA: &str = "document_operation_create_v1";
pub const DOCUMENT_OPERATION_RUN_INPUT_SCHEMA: &str = "document_operation_run_v1";
pub const DOCUMENT_OPERATION_CANCEL_INPUT_SCHEMA: &str = "document_operation_cancel_v1";
pub const DOCUMENT_OPERATION_COMMIT_INPUT_SCHEMA: &str = "document_operation_commit_v1";
pub const DOCUMENT_OPERATION_VIEW_SCHEMA: &str = "document_operation_view_v1";

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateDocumentOperationInput {
    pub schema: String,
    pub idempotency_key: String,
    #[serde(default)]
    pub conversation_id: String,
    pub request_message_id: String,
    pub document_id: String,
    #[serde(default)]
    pub base_job_id: Option<String>,
    pub intent_summary: String,
    #[serde(default)]
    pub source_pdf_sha256: Option<String>,
    #[serde(default)]
    pub normalized_document_sha256: Option<String>,
    pub program_sha256: String,
    #[serde(default)]
    pub program: Option<Value>,
    #[serde(default)]
    pub limits: Option<DocumentOperationLimits>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RunDocumentOperationInput {
    pub schema: String,
    pub idempotency_key: String,
    #[serde(default)]
    pub confirmed: bool,
    #[serde(default)]
    pub retry: bool,
    #[serde(default)]
    pub accept_duplicate_risk: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CancelDocumentOperationInput {
    pub schema: String,
    pub idempotency_key: String,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommitDocumentOperationInput {
    pub schema: String,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentOperationEventView {
    pub seq: u64,
    pub attempt: u32,
    pub ts: String,
    pub event: String,
    pub status: DocumentOperationStatus,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentOperationView {
    pub schema: &'static str,
    pub operation_id: String,
    pub conversation_id: Option<String>,
    pub request_message_id: String,
    pub document_id: String,
    pub base_job_id: String,
    pub base_version_id: Option<String>,
    pub intent_summary: String,
    pub status: DocumentOperationStatus,
    pub current_attempt: u32,
    pub manifest: DocumentOperationWorkspaceManifest,
    pub state: DocumentOperationWorkspaceState,
    pub candidate_version: Option<DocumentVersionView>,
    pub events: Vec<DocumentOperationEventView>,
    pub idempotent_replay: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentVersionView {
    pub version_id: String,
    pub document_id: String,
    pub base_version_id: Option<String>,
    pub operation_id: String,
    pub source_job_id: String,
    pub artifact_key: String,
    pub content_sha256: String,
    pub status: String,
    pub created_at: String,
    pub committed_at: Option<String>,
}

impl From<DocumentVersionRecord> for DocumentVersionView {
    fn from(value: DocumentVersionRecord) -> Self {
        Self {
            version_id: value.version_id,
            document_id: value.document_id,
            base_version_id: value.base_version_id,
            operation_id: value.operation_id,
            source_job_id: value.source_job_id,
            artifact_key: value.artifact_key,
            content_sha256: value.content_sha256,
            status: value.status,
            created_at: value.created_at,
            committed_at: value.committed_at,
        }
    }
}
