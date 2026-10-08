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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobEventFeedItem {
    pub event_id: String,
    #[serde(flatten)]
    pub event: JobEventRecord,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobEventListView {
    pub protocol_version: u32,
    pub items: Vec<JobEventFeedItem>,
    pub next_cursor: String,
    pub has_more: bool,
    pub limit: u32,
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

/// 任务产物目录里一份 JSON 报告的原样内容（translation_qa.v1 / fit_report.v1）。
#[derive(Debug, Serialize)]
pub struct JobReportView {
    pub job_id: String,
    pub report: Value,
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

/// 修订来源:用户手改、agent 改写、精修轮次。写进修订记录,不影响校验。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TranslationRevisionSource {
    User,
    Agent,
    Refine,
}

impl TranslationRevisionSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Agent => "agent",
            Self::Refine => "refine",
        }
    }
}

/// `PATCH /api/v1/jobs/:job_id/translation/items/:item_id` 的请求体。
///
/// `translated_text` 与该块的 `protected_translated_text` 同形态(direct_typst 模式下
/// 就是展示文本,行内公式写成 `$...$`)。`rerender=true` 时写回成功后原地重渲染;
/// 连续改多块时只在最后一块带上它,或者改完后单独调一次 retry-stage。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviseTranslationItemRequest {
    pub translated_text: String,
    pub source: TranslationRevisionSource,
    #[serde(default)]
    pub reason: String,
    /// 乐观并发:带上读到的 checkpoint generation,期间有人改过就返回 409。
    #[serde(default)]
    pub expected_generation: Option<u64>,
    #[serde(default)]
    pub rerender: bool,
}

#[derive(Debug, Serialize)]
pub struct TranslationRevisionView {
    pub job_id: String,
    pub item_id: String,
    /// 译文与状态都和写回前一样时为 false,此时不追加修订记录、不推进 generation。
    pub changed: bool,
    /// 写回后 translation checkpoint 的 generation。
    pub generation: u64,
    pub item: Value,
    pub validation: Value,
    pub revision: Option<Value>,
    /// 本次改写过的页文件 -> 新 page_hash(与 checkpoint 一致)。
    pub page_hashes: Value,
    /// `rerender=true` 时的重渲染提交结果;没请求或提交失败时为 null。
    pub rerender: Option<super::RetryStageSubmissionView>,
    /// 写回已成功、但重渲染没能提交时的原因。写回不会因此回滚。
    pub rerender_error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TranslationRevisionHistoryView {
    pub job_id: String,
    pub item_id: String,
    /// 按写入顺序(旧 -> 新)。
    pub revisions: Vec<Value>,
    pub total: usize,
}
