use serde::{Deserialize, Serialize};

use crate::models::JobStatusKind;

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobStageTiming {
    pub stage: String,
    pub detail: Option<String>,
    pub enter_at: String,
    pub exit_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub terminal_status: Option<JobStatusKind>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobRuntimeInfo {
    pub current_stage: Option<String>,
    pub stage_started_at: Option<String>,
    pub last_stage_transition_at: Option<String>,
    pub terminal_reason: Option<String>,
    pub last_error_at: Option<String>,
    pub total_elapsed_ms: Option<i64>,
    pub active_stage_elapsed_ms: Option<i64>,
    pub retry_count: u32,
    pub last_retry_at: Option<String>,
    pub stage_history: Vec<JobStageTiming>,
    pub final_failure_category: Option<String>,
    pub final_failure_summary: Option<String>,
}
