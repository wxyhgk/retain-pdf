//! 阅读页提问的主对话、副对话和记忆（2026-11-26，数据库 v40）的请求和返回类型。校验和上限在 `ask_conversations.rs`、
//! `ask_memories.rs`；接口见 docs/api/16-AI/02-主对话和记忆.md。请求体、查询参数不认识的字段 400。

use retainpdf_data::db::{AskCompactionRecord, AskConversationMessageRecord, AskConversationRecord, AskMemoryRecord, AskSummaryHit};
use serde::{Deserialize, Serialize};

/// 结构化出处：这一问问的是哪儿。和 ACP `session/prompt` 的 `_meta.retainpdf.selection` 同一个写法。只有 `page` 必填。
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskSelectionInput {
    /// 书（`item_files.file_id`，接口里的 `document_id`）。
    #[serde(default)]
    pub document_id: Option<String>,
    /// 阅读页正在读的任务（合并阅读的 `merged-…` 也行）。
    #[serde(default)]
    pub job_id: Option<String>,
    /// 译文版本编号；读原文、没有版本时不给或 null。
    #[serde(default)]
    pub translation_version: Option<String>,
    /// `source` 原文 / `translated` 译文。
    #[serde(default)]
    pub pane: Option<String>,
    /// 第几页（从 1 起）。
    pub page: u32,
    /// 选区落在哪几块（前端按选区换算）。
    #[serde(default)]
    pub item_ids: Vec<String>,
    #[serde(default)]
    pub selected_text: Option<String>,
    #[serde(default)]
    pub section: Option<String>,
    #[serde(default)]
    pub source_text: Option<String>,
    #[serde(default)]
    pub translated_text: Option<String>,
    /// 选区前后的几个字（换版本、重翻后重新定位用）。
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub suffix: Option<String>,
}

/// 追加的一条消息。
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskConversationMessageInput {
    /// `user` / `assistant`（摘要卡片 `side_summary` 只由结束副对话写）。
    pub role: String,
    pub text: String,
    #[serde(default)]
    pub thought: Option<String>,
    #[serde(default)]
    pub usage: Option<serde_json::Value>,
    /// 问的时候选的 / 答这条的 agent。
    #[serde(default)]
    pub agent_id: Option<String>,
    /// 这条属于哪本书（问的时候在读的书）；不给时取 `selection.document_id`。
    #[serde(default)]
    pub document_id: Option<String>,
    #[serde(default)]
    pub selection: Option<AskSelectionInput>,
    /// 一问带的另外几处出处（2026-11-27，v46）：第一处照旧是 `selection`，这里按顺序放其余的；只有 `user` 能带，最多 4 处。
    #[serde(default)]
    pub extra_selections: Vec<AskSelectionInput>,
    /// 幂等号：同一个对话里重复的不再追加，回原来那条。
    #[serde(default)]
    pub client_message_id: Option<String>,
    /// 这条回答里记下的记忆（出处还空着的补上这条消息）。
    #[serde(default)]
    pub memory_ids: Vec<String>,
    /// 改后重问（2026-11-26 第二期）：被改的那条问的编号，要先 `POST …/messages/{它}/supersede` 作废。只有 `user` 能带。
    #[serde(default)]
    pub edited_from: Option<String>,
    /// 答这条的 agent 会话（ACP 的 `sessionId`，最长 256 字；v44）。删对话时据此删掉 agent 自己存的那份（retainpdf-pi 的会话文件）。
    #[serde(default)]
    pub session_id: Option<String>,
}

/// POST /ai/ask-conversations/:conversation_id/messages：追加一轮（问和答一起）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AppendAskMessagesInput {
    pub messages: Vec<AskConversationMessageInput>,
}

/// POST /ai/ask-conversations/main 的请求体（可以不带；2026-11-27 起主对话按书分）。
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnsureAskMainConversationInput {
    /// 取或建这本书开着的主对话；不给是全局那条（不属于哪本书的）。
    #[serde(default)]
    pub document_id: Option<String>,
}

/// POST /ai/ask-conversations：开副对话。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAskSideConversationInput {
    /// 主对话。
    pub parent_id: String,
    #[serde(default)]
    pub forked_from_message_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub document_id: Option<String>,
}

/// PATCH /ai/ask-conversations/:conversation_id：给了的才改。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchAskConversationInput {
    #[serde(default)]
    pub title: Option<String>,
    /// 主对话 `open` / `archived`；副对话另有 `closed`。
    #[serde(default)]
    pub status: Option<String>,
}

/// POST /ai/ask-conversations/:conversation_id/close：结束副对话。
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CloseAskConversationInput {
    /// 结论；给了就回填到主对话（一张 `side_summary` 卡片）。
    #[serde(default)]
    pub summary: Option<String>,
    /// 没给 `summary` 时，用这条模型让后端自己总结（2026-11-26 第二期）；两个都没给就只结束、不回填。
    #[serde(default)]
    pub summarize_with: Option<AskModelConnectionInput>,
}

/// 后端生成摘要（压缩主对话、副对话结论）用哪条模型：和问答握手同一套字段，就是用户设置里那条连接。
/// 密钥只给 `credential_ref`（凭据库里的编号），不收明文。
#[derive(Debug, Default, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskModelConnectionInput {
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    /// `openai` / `openai_responses` / `anthropic`；不给按 `openai`。
    #[serde(default)]
    pub api_protocol: String,
    #[serde(default)]
    pub thinking: String,
    pub credential_ref: String,
}

/// POST /ai/ask-conversations/:conversation_id/compactions：把上一份摘要之后、最近几轮之前的消息压成一份新摘要。
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAskCompactionInput {
    pub connection: AskModelConnectionInput,
    /// 摘要最多多少字（100–8000，不给 2000）。
    #[serde(default)]
    pub max_chars: Option<u32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListAskConversationsQuery {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    /// 只要这本书的：主对话是这本书的那条（含归档的），副对话是开在这本书的。
    #[serde(default)]
    pub document_id: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListAskMessagesQuery {
    /// 只要 `seq` 比它小的（往前翻页）；不给是最后一页。
    #[serde(default)]
    pub before_seq: Option<i64>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskContextQuery {
    /// 当前在读的书：带上这本书的书层记忆。
    #[serde(default)]
    pub document_id: Option<String>,
    /// 最近几轮（1–20，默认 6）。
    #[serde(default)]
    pub recent_turns: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct AskConversationListView {
    pub conversations: Vec<AskConversationRecord>,
}

#[derive(Debug, Serialize)]
pub struct AskMessagePageView {
    pub conversation_id: String,
    pub messages: Vec<AskConversationMessageRecord>,
    /// 前面还有没有更早的（再用第一条的 `seq` 当 `before_seq` 取）。
    pub has_more: bool,
    /// 这个对话所有生效的压缩点（不只这一页的；作废的不在），按 `covers_to_seq` 从小到大：`seq <= covers_to_seq` 的消息已经被那份摘要替代
    /// （原文还在），前端在那条后面画「之前的已压缩，点开看原文」。没压过是空的。
    pub compactions: Vec<AskCompactionPointView>,
}

/// 「从这条问起作废」（改后重问）的返回：作废了哪些消息、哪些压缩摘要。
#[derive(Debug, Serialize)]
pub struct SupersedeAskMessagesView {
    pub conversation: AskConversationRecord,
    pub superseded_message_ids: Vec<String>,
    pub superseded_compaction_ids: Vec<String>,
}

/// 一个压缩点（不带摘要正文；正文在 GET …/compactions）。
#[derive(Debug, Serialize)]
pub struct AskCompactionPointView {
    pub compaction_id: String,
    pub covers_to_seq: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct AppendAskMessagesView {
    pub conversation: AskConversationRecord,
    pub messages: Vec<AskConversationMessageRecord>,
    /// 上一份摘要之后的消息太长了（超过阈值），该压了：前端有模型配置就随手 `POST …/compactions`。没配模型可以不管。
    pub compaction_due: bool,
}

#[derive(Debug, Serialize)]
pub struct CreateAskCompactionView {
    pub conversation: AskConversationRecord,
    pub compaction: AskCompactionRecord,
    /// 压完以后还该不该再压（一般是 false）。
    pub compaction_due: bool,
}

#[derive(Debug, Serialize)]
pub struct AskCompactionListView {
    pub conversation_id: String,
    pub compactions: Vec<AskCompactionRecord>,
}

#[derive(Debug, Serialize)]
pub struct CloseAskConversationView {
    pub conversation: AskConversationRecord,
    /// 回到主对话的摘要卡片；没给摘要（或主对话不是 open）是 null。
    pub card: Option<AskConversationMessageRecord>,
}

#[derive(Debug, Serialize)]
pub struct AskConversationDeleteResultView {
    pub conversation_id: String,
    pub deleted: bool,
}

/// 开新会话用的记忆：用户层每次都带，书层是当前这本书的；各有字数上限，放不下的条数在 `*_omitted`。
#[derive(Debug, Serialize)]
pub struct AskContextMemoriesView {
    pub user: Vec<AskMemoryRecord>,
    pub user_omitted: usize,
    pub book: Vec<AskMemoryRecord>,
    pub book_omitted: usize,
}

/// 副对话的主对话前文（到分叉那条为止的最近几轮）。
#[derive(Debug, Serialize)]
pub struct AskContextParentView {
    pub conversation_id: String,
    pub messages: Vec<AskConversationMessageRecord>,
}

/// GET /ai/ask-conversations/:conversation_id/context。
#[derive(Debug, Serialize)]
pub struct AskContextView {
    pub conversation: AskConversationRecord,
    /// 「让 AI 使用记忆」开着没有；关着时 `memories` 是空的、`memory_text` 是空串，agent 也不能记、不能查。
    pub memory_enabled: bool,
    /// 生效的那份压缩摘要（2026-11-26 第二期）；没压过是 null。有的话 `messages` 只是它之后的最近几轮。
    pub summary: Option<String>,
    /// 那份摘要替代到第几条（`seq <= summary_covers_to_seq`）；没压过是 null。
    pub summary_covers_to_seq: Option<i64>,
    pub parent: Option<AskContextParentView>,
    /// 最近几轮（不分书），按 `seq` 从小到大。
    pub messages: Vec<AskConversationMessageRecord>,
    /// 更早的还有几条没带。
    pub omitted_messages: i64,
    pub memories: AskContextMemoriesView,
    /// 记忆那段（给模型看的写法），放进系统提示词；没有记忆是空串。
    pub memory_text: String,
    /// 整份拼好的文字（记忆 + 前文），给不认结构的本机 agent 放进第一问前面；什么都没有是空串。
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct DocumentAskMessagesView {
    pub document_id: String,
    pub messages: Vec<AskConversationMessageRecord>,
}

// --- 记忆 ---

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListAskMemoriesQuery {
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub document_id: Option<String>,
    /// 全文检索（空格隔开的词都要在）。
    #[serde(default)]
    pub q: Option<String>,
    /// `active`（默认）/ `superseded` / `deleted` / `all`。
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub source_conversation_id: Option<String>,
    /// 只要这个时间之后记的（前端每答完一轮补画「已记住」用）。
    #[serde(default)]
    pub created_after: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// 给了 `q` 时一起查对话摘要（副对话的结论、生效的压缩摘要），结果在 `summaries`（2026-11-26 第二期，agent 的 search_memories 用）。
    #[serde(default)]
    pub include_summaries: Option<bool>,
}

/// POST /ai/memories：记一条。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAskMemoryInput {
    /// `user` / `book`。
    pub scope: String,
    /// 书层必填，用户层不给。
    #[serde(default)]
    pub document_id: Option<String>,
    /// 默认 `other`。
    #[serde(default)]
    pub category: Option<String>,
    pub text: String,
    /// `user`（默认，用户在记忆面板里加的）/ `agent`。
    #[serde(default)]
    pub origin: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub source_conversation_id: Option<String>,
    #[serde(default)]
    pub source_message_id: Option<String>,
    #[serde(default)]
    pub source_job_id: Option<String>,
    #[serde(default)]
    pub source_page: Option<u32>,
    /// 替代哪一条（旧的标 superseded）。
    #[serde(default)]
    pub replaces: Option<String>,
}

/// PATCH /ai/ask-settings：给了的才改。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchAskSettingsInput {
    /// 「让 AI 使用记忆」总开关。
    #[serde(default)]
    pub memory_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchAskMemoryInput {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AskMemoryListView {
    pub memories: Vec<AskMemoryRecord>,
    /// `include_summaries=true` 且给了 `q` 才有：查到的对话摘要，最近的在前，每份最多 1000 字。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summaries: Option<Vec<AskSummaryHit>>,
}

#[derive(Debug, Serialize)]
pub struct AskMemoryCreatedView {
    pub memory: AskMemoryRecord,
    /// false：同层同书已经有一模一样的一条，回的是那条。
    pub created: bool,
    /// 被替代的那条的编号。
    pub replaced: Option<String>,
}
