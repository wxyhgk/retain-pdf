//! Application facade for the backend-only document operation control API.
//!
//! HTTP routes import this module instead of reaching into the internal
//! control-plane implementation.

pub use super::agent_capabilities::{
    authorize_create_scope, authorize_operation_scope, AgentCapabilityClaims,
};
pub use super::document_operations::{
    cancel_document_operation, commit_document_operation, create_document_operation,
    get_document_operation_view, run_document_operation, CancelDocumentOperationInput,
    CommitDocumentOperationInput, CreateDocumentOperationInput, DocumentOperationView,
    RunDocumentOperationInput,
};
