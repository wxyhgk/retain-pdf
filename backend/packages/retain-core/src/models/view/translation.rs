use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct JobEventProgressView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct JobEventRawView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_seq: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobEventRecord {
    pub job_id: String,
    pub seq: i64,
    pub ts: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub created_at: String,
    pub level: String,
    #[serde(default, skip_serializing)]
    pub user_stage: Option<String>,
    #[serde(default)]
    pub lane: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_stage: Option<String>,
    pub stage: Option<String>,
    #[serde(default)]
    pub substage: Option<String>,
    #[serde(default)]
    pub stage_detail: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub provider_stage: Option<String>,
    pub event: String,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub raw_event_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw: Option<JobEventRawView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress: Option<JobEventProgressView>,
    pub message: String,
    #[serde(default, skip_serializing)]
    pub progress_current: Option<i64>,
    #[serde(default, skip_serializing)]
    pub progress_total: Option<i64>,
    #[serde(default, skip_serializing)]
    pub progress_unit: Option<String>,
    #[serde(default)]
    pub retry_count: Option<u32>,
    #[serde(default)]
    pub elapsed_ms: Option<i64>,
    pub payload: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JobEventListView {
    pub items: Vec<JobEventRecord>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TranslationDebugListItemView {
    #[serde(default)]
    pub item_id: String,
    #[serde(default)]
    pub page_idx: i64,
    #[serde(default)]
    pub page_number: i64,
    #[serde(default)]
    pub block_idx: i64,
    #[serde(default)]
    pub block_type: String,
    #[serde(default)]
    pub math_mode: String,
    #[serde(default)]
    pub continuation_group: String,
    #[serde(default)]
    pub classification_label: String,
    #[serde(default)]
    pub should_translate: bool,
    #[serde(default)]
    pub skip_reason: String,
    #[serde(default)]
    pub final_status: String,
    #[serde(default)]
    pub source_preview: String,
    #[serde(default)]
    pub translated_preview: String,
    #[serde(default)]
    pub route_path: Vec<String>,
    #[serde(default)]
    pub fallback_to: String,
    #[serde(default)]
    pub degradation_reason: String,
    #[serde(default)]
    pub error_types: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TranslationDebugIndexView {
    #[serde(default)]
    pub schema: String,
    #[serde(default)]
    pub schema_version: i64,
    #[serde(default)]
    pub items: Vec<TranslationDebugListItemView>,
}

#[derive(Debug, Serialize)]
pub struct TranslationDiagnosticsView {
    pub job_id: String,
    pub summary: Value,
}

#[derive(Debug, Serialize)]
pub struct TranslationDebugListView {
    pub items: Vec<TranslationDebugListItemView>,
    pub total: usize,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Serialize)]
pub struct TranslationDebugItemView {
    pub job_id: String,
    pub item_id: String,
    pub page_idx: i64,
    pub page_number: i64,
    pub page_path: String,
    pub item: Value,
}

#[derive(Debug, Serialize)]
pub struct TranslationReplayView {
    pub job_id: String,
    pub item_id: String,
    pub payload: Value,
}
