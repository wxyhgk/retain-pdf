//! Internal persistence boundary for conversation-to-agent-runtime cursors.
//!
//! The Rust database is authoritative. An adapter may lose its local process
//! and rebuild from conversation history, but it may not overwrite a cursor
//! published by a newer adapter instance without passing revision CAS.

use retain_data::db::{AgentRuntimeSessionRecord, Db, PutAgentRuntimeSessionResult};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const AGENT_RUNTIME_SESSION_PUT_SCHEMA: &str = "agent_runtime_session_put_v1";
pub const AGENT_RUNTIME_SESSION_CLEAR_SCHEMA: &str = "agent_runtime_session_clear_v1";
pub const AGENT_RUNTIME_SESSION_VIEW_SCHEMA: &str = "agent_runtime_session_view_v1";

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PutAgentRuntimeSessionInput {
    pub schema: String,
    pub runtime_id: String,
    pub session_cursor: String,
    pub expected_revision: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClearAgentRuntimeSessionInput {
    pub schema: String,
    pub expected_revision: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AgentRuntimeSessionView {
    pub schema: &'static str,
    pub conversation_id: String,
    pub runtime_id: String,
    pub session_cursor: String,
    pub revision: u64,
    pub updated_at: String,
}

impl From<AgentRuntimeSessionRecord> for AgentRuntimeSessionView {
    fn from(record: AgentRuntimeSessionRecord) -> Self {
        Self {
            schema: AGENT_RUNTIME_SESSION_VIEW_SCHEMA,
            conversation_id: record.conversation_id,
            runtime_id: record.runtime_id,
            session_cursor: record.session_cursor,
            revision: record.revision,
            updated_at: record.updated_at,
        }
    }
}

pub fn get_agent_runtime_session(
    db: &Db,
    conversation_id: &str,
) -> Result<AgentRuntimeSessionView, AppError> {
    let record = db
        .get_agent_runtime_session(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;
    Ok(record.into())
}

pub fn put_agent_runtime_session(
    db: &Db,
    conversation_id: &str,
    input: &PutAgentRuntimeSessionInput,
) -> Result<AgentRuntimeSessionView, AppError> {
    validate_schema(&input.schema, AGENT_RUNTIME_SESSION_PUT_SCHEMA)?;
    validate_runtime_id(&input.runtime_id)?;
    validate_cursor(&input.session_cursor)?;
    validate_revision(input.expected_revision)?;
    match db.put_agent_runtime_session(
        conversation_id,
        input.runtime_id.trim(),
        input.session_cursor.trim(),
        input.expected_revision,
    )? {
        None => Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        ))),
        Some(PutAgentRuntimeSessionResult::Updated(record)) => Ok(record.into()),
        Some(PutAgentRuntimeSessionResult::RevisionConflict(current)) => {
            Err(AppError::conflict(format!(
                "agent runtime session revision conflict: expected {}, current {}",
                input.expected_revision, current.revision
            )))
        }
    }
}

pub fn clear_agent_runtime_session(
    db: &Db,
    conversation_id: &str,
    input: &ClearAgentRuntimeSessionInput,
) -> Result<AgentRuntimeSessionView, AppError> {
    validate_schema(&input.schema, AGENT_RUNTIME_SESSION_CLEAR_SCHEMA)?;
    validate_revision(input.expected_revision)?;
    match db.clear_agent_runtime_session(conversation_id, input.expected_revision)? {
        None => Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        ))),
        Some(PutAgentRuntimeSessionResult::Updated(record)) => Ok(record.into()),
        Some(PutAgentRuntimeSessionResult::RevisionConflict(current)) => {
            Err(AppError::conflict(format!(
                "agent runtime session revision conflict: expected {}, current {}",
                input.expected_revision, current.revision
            )))
        }
    }
}

fn validate_schema(actual: &str, expected: &str) -> Result<(), AppError> {
    if actual.trim() == expected {
        Ok(())
    } else {
        Err(AppError::bad_request(format!(
            "unsupported schema: expected {expected}"
        )))
    }
}

fn validate_runtime_id(runtime_id: &str) -> Result<(), AppError> {
    let value = runtime_id.trim();
    if value.is_empty() || value.len() > 64 {
        return Err(AppError::bad_request(
            "runtime_id must contain between 1 and 64 bytes",
        ));
    }
    if !value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(AppError::bad_request(
            "runtime_id contains unsafe characters",
        ));
    }
    Ok(())
}

fn validate_cursor(cursor: &str) -> Result<(), AppError> {
    let value = cursor.trim();
    if value.is_empty() || value.len() > 256 {
        return Err(AppError::bad_request(
            "session_cursor must contain between 1 and 256 bytes",
        ));
    }
    if value.chars().any(char::is_control) {
        return Err(AppError::bad_request(
            "session_cursor contains control characters",
        ));
    }
    Ok(())
}

fn validate_revision(revision: u64) -> Result<(), AppError> {
    if revision > i64::MAX as u64 {
        return Err(AppError::bad_request(
            "expected_revision exceeds the supported range",
        ));
    }
    Ok(())
}
