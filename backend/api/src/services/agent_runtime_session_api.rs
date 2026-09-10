//! Application facade for durable conversation-to-agent-runtime cursors.

use crate::db::Db;
use crate::error::AppError;

pub use super::agent_runtime_sessions::{
    AgentRuntimeSessionView, ClearAgentRuntimeSessionInput, PutAgentRuntimeSessionInput,
};

pub struct AgentRuntimeSessionApiDeps<'a> {
    db: &'a Db,
}

impl<'a> AgentRuntimeSessionApiDeps<'a> {
    pub fn new(db: &'a Db) -> Self {
        Self { db }
    }
}

pub fn get_agent_runtime_session(
    deps: &AgentRuntimeSessionApiDeps<'_>,
    conversation_id: &str,
) -> Result<AgentRuntimeSessionView, AppError> {
    super::agent_runtime_sessions::get_agent_runtime_session(deps.db, conversation_id)
}

pub fn put_agent_runtime_session(
    deps: &AgentRuntimeSessionApiDeps<'_>,
    conversation_id: &str,
    input: &PutAgentRuntimeSessionInput,
) -> Result<AgentRuntimeSessionView, AppError> {
    super::agent_runtime_sessions::put_agent_runtime_session(deps.db, conversation_id, input)
}

pub fn clear_agent_runtime_session(
    deps: &AgentRuntimeSessionApiDeps<'_>,
    conversation_id: &str,
    input: &ClearAgentRuntimeSessionInput,
) -> Result<AgentRuntimeSessionView, AppError> {
    super::agent_runtime_sessions::clear_agent_runtime_session(deps.db, conversation_id, input)
}
