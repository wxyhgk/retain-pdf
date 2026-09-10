//! Durable pipeline records shared by the state-machine persistence modules.

//! Public durable-pipeline data transfer types.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PipelineAttemptCursor {
    pub job_id: String,
    pub attempt: u32,
    pub generation: u64,
    pub worker_id: String,
    pub stage_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PipelineCheckpoint {
    pub job_id: String,
    pub attempt: u32,
    pub generation: u64,
    pub stage_key: String,
    pub last_committed_unit_key: Option<String>,
    pub last_committed_unit_order: Option<u64>,
    pub last_page_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineUnitCommit {
    pub unit_key: String,
    pub unit_order: u64,
    pub page_index: Option<u32>,
    pub page_hash: String,
    pub producer_generation: Option<u64>,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineUnitRecord {
    pub attempt: u32,
    pub unit_key: String,
    pub unit_order: u64,
    pub generation: u64,
    pub producer_generation: Option<u64>,
    pub page_index: Option<u32>,
    pub page_hash: String,
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineCommitEventRecord {
    pub seq: i64,
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineStageObservation {
    pub producer_seq: u64,
    pub producer_ts: String,
    pub event_type: String,
    pub raw_stage: String,
    pub substage: Option<String>,
    pub stage_detail: Option<String>,
    pub message: String,
    pub provider: Option<String>,
    pub provider_stage: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
    pub progress_unit: Option<String>,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineStageState {
    pub job_id: String,
    pub attempt: u32,
    pub stage_key: String,
    pub generation: u64,
    pub status: String,
    pub raw_stage: Option<String>,
    pub substage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
    pub progress_unit: Option<String>,
    pub producer_seq: Option<u64>,
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PipelineDispatchIntent {
    pub dispatch_key: String,
    pub provider: String,
    pub operation: String,
    pub request_hash: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineDispatchRecord {
    pub job_id: String,
    pub attempt: u32,
    pub stage_key: String,
    pub dispatch_key: String,
    pub generation: u64,
    pub provider: String,
    pub operation: String,
    pub request_hash: String,
    pub status: String,
    pub receipt: Option<Value>,
    pub ambiguity_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PipelineDispatchBegin {
    Send {
        cursor: PipelineAttemptCursor,
    },
    Resume {
        cursor: PipelineAttemptCursor,
        receipt: Value,
    },
    Ambiguous {
        cursor: PipelineAttemptCursor,
        reason: String,
    },
}
