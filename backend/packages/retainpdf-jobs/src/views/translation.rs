use serde::{Deserialize, Serialize};
use serde_json::Value;

use retainpdf_core::models::api::{JobEventRecord};

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

#[derive(Debug, Serialize)]
pub struct TranslationDebugListView {
    pub items: Vec<TranslationDebugListItemView>,
    pub total: usize,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
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
    /// 重翻出来、可以直接交给 PATCH 写回的结果（稳定字段，前端用这个，不读 `payload`）。
    /// 模型调用失败、条目不需要翻译、或者模型给了空译文时为 null。
    pub candidate: Option<TranslationReplayCandidate>,
}

/// 重翻结果。`translated_text` 和 PATCH 的 `translated_text` 同一种写法；
/// `decision = keep_origin` 表示模型判断这一段该保留原文，不要写回。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TranslationReplayCandidate {
    pub translated_text: String,
    pub decision: &'static str,
}

impl TranslationReplayCandidate {
    /// 从重放脚本的输出里取：和脚本自己的 `--commit`（`_commit_replay_result`）同一个判断。
    pub fn from_payload(payload: &Value) -> Option<Self> {
        if payload.get("replay_error").is_some_and(|error| !error.is_null()) {
            return None;
        }
        let result = payload.get("replay_result")?.as_object()?;
        let decision = match result
            .get("decision")
            .and_then(Value::as_str)
            .unwrap_or("translate")
            .trim()
        {
            "keep_origin" => "keep_origin",
            _ => "translate",
        };
        let translated_text = result
            .get("translated_text")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if decision == "translate" && translated_text.trim().is_empty() {
            return None;
        }
        Some(Self {
            translated_text,
            decision,
        })
    }
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

/// `PATCH /api/v1/jobs/:job_id/translations/:item_id` 的请求体。
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
    /// 修订登记进实时译文读模型(数据库)的结果。写回不会因登记失败而回滚。
    pub live_publication: TranslationRevisionLivePublicationView,
    /// `rerender=true` 时的重渲染提交结果;没请求或提交失败时为 null。
    pub rerender: Option<super::RetryStageSubmissionView>,
    /// 写回已成功、但重渲染没能提交时的原因。写回不会因此回滚。
    pub rerender_error: Option<String>,
}

/// 修订登记进实时译文读模型的结果。
///
/// `status`:
/// - `published`:至少一页登记了新 page_hash,并追加了提交事件;
/// - `current`:数据库已是最新(没有要登记的,或别的请求已登记);
/// - `pending`:该页归正在运行的 attempt 所有,由 worker 提交;
/// - `unavailable`:任务没有持久的翻译记录(老任务),实时译文本来就读不到;
/// - `failed`:登记失败(`error` 给原因)。写回已生效;重发同一请求或重新打开
///   实时译文会补登记。
#[derive(Debug, Clone, Serialize)]
pub struct TranslationRevisionLivePublicationView {
    pub status: String,
    pub pages: Vec<TranslationRevisionLivePageView>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationRevisionLivePageView {
    pub page_idx: u32,
    pub page_hash: String,
    /// published / current / superseded / running_attempt / no_durable_attempt
    pub status: String,
    pub attempt: Option<u32>,
    pub generation: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct TranslationRevisionHistoryView {
    pub job_id: String,
    pub item_id: String,
    /// 按写入顺序(旧 -> 新)。
    pub revisions: Vec<Value>,
    pub total: usize,
}

#[cfg(test)]
mod replay_candidate_tests {
    use super::TranslationReplayCandidate;
    use serde_json::json;

    #[test]
    fn candidate_is_the_replayed_text_ready_for_patch() {
        let payload = json!({
            "replay_result": {"decision": "translate", "translated_text": "译文 $x$"},
            "replay_error": null,
        });
        assert_eq!(
            TranslationReplayCandidate::from_payload(&payload),
            Some(TranslationReplayCandidate {
                translated_text: "译文 $x$".to_string(),
                decision: "translate",
            })
        );
    }

    #[test]
    fn keep_origin_is_reported_so_the_client_does_not_write_it_back() {
        let payload = json!({"replay_result": {"decision": "keep_origin", "translated_text": ""}, "replay_error": null});
        let candidate = TranslationReplayCandidate::from_payload(&payload).expect("keep_origin 也给出来");
        assert_eq!(candidate.decision, "keep_origin");
    }

    #[test]
    fn no_candidate_when_the_model_failed_or_returned_nothing() {
        for payload in [
            json!({"replay_result": null, "replay_error": {"type": "HTTPError", "message": "401"}}),
            json!({"replay_result": {"decision": "translate", "translated_text": "残留"}, "replay_error": {"type": "X", "message": "y"}}),
            json!({"replay_result": {}, "replay_error": null}),
            json!({"replay_result": {"decision": "translate", "translated_text": "  "}, "replay_error": null}),
            json!({}),
        ] {
            assert_eq!(TranslationReplayCandidate::from_payload(&payload), None, "{payload}");
        }
    }
}
