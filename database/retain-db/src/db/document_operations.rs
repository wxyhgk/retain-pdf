use crate::models::domain::{
    DocumentOperationStatus, DocumentOperationWorkspaceManifest, DocumentOperationWorkspaceState,
};

#[path = "document_operations/attempts.rs"]
mod attempts;
#[path = "document_operations/events.rs"]
mod events;
#[path = "document_operations/operations.rs"]
mod operations;
#[path = "document_operations/recovery.rs"]
mod recovery;
#[path = "document_operations/transitions.rs"]
mod transitions;
#[path = "document_operations/versions.rs"]
mod versions;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredDocumentOperation {
    pub operation_id: String,
    pub conversation_id: Option<String>,
    pub request_message_id: String,
    pub document_id: String,
    pub base_job_id: String,
    pub base_version_id: Option<String>,
    pub intent_summary: String,
    pub status: DocumentOperationStatus,
    pub current_attempt: u32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredDocumentOperationAttempt {
    pub manifest: DocumentOperationWorkspaceManifest,
    pub state: DocumentOperationWorkspaceState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentOperationEventRecord {
    pub seq: u64,
    pub attempt: u32,
    pub ts: String,
    pub event: String,
    pub status: DocumentOperationStatus,
    pub payload_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentVersionRecord {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommitDocumentCandidateResult {
    Committed,
    StaleBase,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreateDocumentOperationAttemptResult {
    Created,
    IdempotentReplay,
}

#[cfg(test)]
#[path = "document_operations/tests.rs"]
mod tests;
