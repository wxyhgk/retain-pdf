//! Stable application facade for durable Agent calculation APIs.

use std::path::Path;

use crate::db::Db;
use crate::error::AppError;

pub use super::service::{
    AgentCalculationArtifactDownload, AgentCalculationListQuery, AgentCalculationListView,
    AgentCalculationView, CompleteAgentCalculationInput, CreateAgentCalculationInput,
    FailAgentCalculationInput,
};

pub struct AgentCalculationApiDeps<'a> {
    db: &'a Db,
    data_root: &'a Path,
}

impl<'a> AgentCalculationApiDeps<'a> {
    pub fn new(db: &'a Db, data_root: &'a Path) -> Self {
        Self { db, data_root }
    }
}

pub fn create_agent_calculation(
    deps: &AgentCalculationApiDeps<'_>,
    input: &CreateAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    super::service::create_agent_calculation(deps.db, input)
}

pub fn complete_agent_calculation(
    deps: &AgentCalculationApiDeps<'_>,
    calculation_id: &str,
    input: &CompleteAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    super::service::complete_agent_calculation(
        deps.db,
        deps.data_root,
        calculation_id,
        input,
    )
}

pub fn fail_agent_calculation(
    deps: &AgentCalculationApiDeps<'_>,
    calculation_id: &str,
    input: &FailAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    super::service::fail_agent_calculation(deps.db, calculation_id, input)
}

pub fn get_agent_calculation(
    deps: &AgentCalculationApiDeps<'_>,
    calculation_id: &str,
) -> Result<AgentCalculationView, AppError> {
    super::service::get_agent_calculation(deps.db, calculation_id)
}

pub fn list_agent_calculations(
    deps: &AgentCalculationApiDeps<'_>,
    conversation_id: &str,
    query: &AgentCalculationListQuery,
) -> Result<AgentCalculationListView, AppError> {
    super::service::list_agent_calculations(deps.db, conversation_id, query)
}

pub fn agent_calculation_artifact_download(
    deps: &AgentCalculationApiDeps<'_>,
    calculation_id: &str,
    artifact_id: &str,
) -> Result<AgentCalculationArtifactDownload, AppError> {
    super::service::agent_calculation_artifact_download(
        deps.db,
        deps.data_root,
        calculation_id,
        artifact_id,
    )
}
