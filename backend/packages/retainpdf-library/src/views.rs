//! 书库接口的请求和返回类型：文档、元数据建议、全文检索、文件夹（`/api/v1/documents`、`/search`、
//! `/collections`）。2026-10-18 从核心包挪过来；书架（`/api/v1/library/books`）的类型 2026-10-22 跟接口一起删了，
//! AI 对话（`/ai/conversations`）的 2026-11-03 跟 AI 服务一起删了。
//! 库里存的记录（`DocumentRecord` 这些）还在核心包，数据库层要用。

use retainpdf_core::models::api::{
    BlockSearchHit, CollectionRecord, DocumentRecord, TagRecord,
};
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::request::CreateJobInput;
use retainpdf_data::db::{AskMessageRecord, AskThreadRecord};
use serde::{Deserialize, Serialize};

fn default_documents_limit() -> u32 {
    50
}

fn default_metadata_suggestion_fields() -> Vec<String> {
    vec!["title".to_string()]
}

fn default_metadata_suggestion_limit() -> u32 {
    20
}

fn default_search_limit() -> u32 {
    retainpdf_core::config::limits::DEFAULT_LIST_LIMIT
}

/// GET /api/v1/documents 查询参数。不认识的参数 400（2026-10-22 起；以前的标签参数 `tag` 早已删掉，2026-11-21 起按标签筛用 `tag_id`）。
/// 带 `job_id` 时是另一种查法：只按任务找它所属的书，其余参数不起作用（`limit` 照样校验）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListDocumentsQuery {
    #[serde(default = "default_documents_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    pub reading_status: Option<String>,
    pub collection_id: Option<String>,
    /// 打了这个标签的书（`GET /api/v1/tags` 列出的 `tag_id`）。
    pub tag_id: Option<String>,
    /// 按任意 job_id(含历史 run)直查其所属文档,前端无需再扫列表反查
    pub job_id: Option<String>,
    /// 文档级文本搜索:标题或原始文件名任一包含即命中(大小写不敏感)。
    ///
    /// 与 /api/v1/search 的区别:那个搜的是**块级正文**(阅读器的全文命中),
    /// 这个只搜文档自身的标题与文件名,用于书架检索。
    ///
    /// 加这个字段之前,前端只能拉前 200 篇做客户端过滤并把 hasMore 钉成 false,
    /// 超过 200 篇的库里搜索会静默漏结果。
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DocumentListView {
    pub documents: Vec<DocumentRecord>,
    /// Number of documents matching the filters before pagination.
    pub total: u64,
    /// 生效的 `limit`（没传就是默认值；越界 400，不夹）。
    pub limit: u32,
    pub offset: u32,
    /// 这一页之后还有没有：`offset + 这一页条数 < total`（页和 total 读自同一个快照）。
    pub has_more: bool,
}

/// PATCH /api/v1/documents/:id。只认 `title`、`reading_status`，别的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchDocumentInput {
    pub title: Option<String>,
    pub reading_status: Option<String>,
}

/// POST /api/v1/documents/:id/metadata-suggestions。不认识的字段 400（拼错的 `apply_if_default`
/// 不会悄悄变成「不自动应用」）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateDocumentMetadataSuggestionInput {
    /// 缺省时选择该文档最新的可读规范化 OCR 产物。
    #[serde(default)]
    pub job_id: Option<String>,
    /// v1 仅支持 title；保留数组以便后续扩展 authors/year/doi。
    #[serde(default = "default_metadata_suggestion_fields")]
    pub fields: Vec<String>,
    /// 仅当当前标题仍是上传文件名且未被用户锁定时自动应用。
    #[serde(default)]
    pub apply_if_default: bool,
}

/// GET /api/v1/documents/:id/metadata-suggestions。只认 `limit`（1..=100），没有 `offset`。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListDocumentMetadataSuggestionsQuery {
    #[serde(default = "default_metadata_suggestion_limit")]
    pub limit: u32,
}

/// POST /api/v1/documents/:id/metadata-suggestions/:suggestion_id/apply。不认识的字段 400
/// （拼错的版本护栏不会悄悄变成「不检查」）。
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApplyDocumentMetadataSuggestionInput {
    /// 可选的文档版本护栏；不匹配时返回 409。
    #[serde(default)]
    pub expected_document_updated_at: Option<String>,
}

/// `POST /documents/:id/translate`、`/ocr` 的请求体：和 `POST /jobs` 同一个 `CreateJobInput`
/// （同样的解析、同样的 `invalid job payload: …` 提示），另记下客户端写没写 `workflow`——
/// `workflow` 缺省是 book，`/ocr` 要分清「没写」和「写了 book」，后者是和入口矛盾的请求。
#[derive(Debug, Clone)]
pub struct DocumentJobRequest {
    pub(crate) input: CreateJobInput,
    pub(crate) workflow_given: bool,
}

impl DocumentJobRequest {
    pub fn from_api_value(value: serde_json::Value) -> Result<Self, AppError> {
        let workflow_given = value.get("workflow").is_some();
        let input = CreateJobInput::from_api_value(value)
            .map_err(|error| AppError::invalid_json_body("invalid job payload", &error))?;
        Ok(Self { input, workflow_given })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DocumentMetadataEvidenceView {
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_idx: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structure_role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DocumentTitleCandidateView {
    pub value: String,
    pub source: String,
    pub confidence: f64,
    pub evidence: Vec<DocumentMetadataEvidenceView>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DocumentMetadataSuggestionView {
    pub suggestion_id: String,
    pub document_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_job_id: Option<String>,
    pub artifact_sha256: String,
    pub status: String,
    pub fields: Vec<String>,
    pub title_candidates: Vec<DocumentTitleCandidateView>,
    pub selected_title: String,
    pub generation_method: String,
    pub needs_ai_review: bool,
    pub applied: bool,
    pub can_apply: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct DocumentMetadataSuggestionListView {
    pub suggestions: Vec<DocumentMetadataSuggestionView>,
    /// 生效的 `limit`。
    pub limit: u32,
    /// 还有更早的建议（多取一条判断）。
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct DocumentMetadataSuggestionApplyView {
    pub suggestion: DocumentMetadataSuggestionView,
    pub document: DocumentRecord,
}

/// GET /api/v1/search。只认 `q`、`limit`（1..=100）、`document_id`，没有 `offset`。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_search_limit")]
    pub limit: u32,
    /// 限定单文档（阅读器 / AI 整本问答）；空 = 全库
    #[serde(default)]
    pub document_id: String,
}

/// 一个块级命中：库里存的那一行，加上按整本书算的页号。
#[derive(Debug, Serialize)]
pub struct SearchHitView {
    #[serde(flatten)]
    pub hit: BlockSearchHit,
    /// 这一块在整本书里是第几页（1 起），和 `GET /documents/:id/reading` 给的阅读任务的页序一致
    /// （合并任务按整本书编页：本地页 = 这个数 - 1）。`page_idx` 是建索引那个任务（`job_id`）自己的
    /// 本地页号，分段翻译时两者不同。任务记录读不到时是 `null`。
    pub document_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SearchResultView {
    pub query: String,
    pub hits: Vec<SearchHitView>,
    /// 生效的 `limit`。
    pub limit: u32,
    /// 命中不止这么多（多取一条判断）。没有 `offset`，要更多就加大 `limit`。
    pub has_more: bool,
}

/// POST /api/v1/collections。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateCollectionInput {
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionListView {
    pub collections: Vec<CollectionRecord>,
}

/// PATCH /api/v1/collections/:id：只能改名字和排序。`parent_id` 从来改不了，2026-10-22 起传了是 400
/// （以前 200 但不生效）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchCollectionInput {
    pub name: Option<String>,
    pub sort_order: Option<i64>,
}

/// POST /api/v1/collections/:id/documents。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AddCollectionDocumentsInput {
    pub document_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed: Option<bool>,
}

/// POST /api/v1/tags。同名（不分大小写、不看首尾空白）的标签已经有了就返回那个，不再建。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateTagInput {
    pub name: String,
    /// `#RRGGBB`；不给或空字符串 = 不设颜色。
    #[serde(default)]
    pub color: Option<String>,
}

/// PATCH /api/v1/tags/:tag_id：改名、改颜色，都可以不给。改成别的标签已经在用的名字 409。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchTagInput {
    pub name: Option<String>,
    pub color: Option<String>,
}

/// PUT /api/v1/documents/:document_id/tags：书的标签设成正好这几个（空数组 = 全去掉）。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetDocumentTagsInput {
    pub tag_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TagListView {
    pub tags: Vec<TagRecord>,
}

#[derive(Debug, Serialize)]
pub struct TagDeleteResultView {
    pub tag_id: String,
    pub deleted: bool,
}

// --- 阅读页提问的问答记录（2026-11-25，数据库 v39；校验和上限见 `ask_threads.rs`）---

/// 请求里的锚点：问的是哪儿。和阅读器的 `ReaderAskAnchor` 一一对应（字段名改成下划线）。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskAnchorInput {
    /// `source` 原文 / `translated` 译文。
    pub pane: String,
    /// 第几页（从 1 起）。
    pub page: u32,
    /// 鼠标下面那一块；认不出不给或 null。
    #[serde(default)]
    pub item_id: Option<String>,
    /// 选中的字；不给、null、空串都是没选。下面三个同理。
    #[serde(default)]
    pub selection: Option<String>,
    #[serde(default)]
    pub source_text: Option<String>,
    #[serde(default)]
    pub translated_text: Option<String>,
    #[serde(default)]
    pub section: Option<String>,
    /// 页内位置（占整页的比例，0–1）；没有不给或 null。
    #[serde(default)]
    pub point: Option<AskPointInput>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskPointInput {
    pub x: f64,
    pub y: f64,
}

/// 请求里的一条问或答。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskMessageInput {
    /// `user` / `assistant`。
    pub role: String,
    pub text: String,
    /// 思考摘要；没有不给、null 或空串。
    #[serde(default)]
    pub thought: Option<String>,
    /// 用量（JSON 对象，原样存，例如自带 agent 的 `_meta.retainpdf.usage`）；没有不给或 null。
    #[serde(default)]
    pub usage: Option<serde_json::Value>,
}

/// POST /api/v1/documents/:document_id/ask-threads：在书上记一次提问（可以连开头几条问答一起）。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAskThreadInput {
    /// 用的哪个 agent（`GET /ai/agents` 里的 `id`：`retainpdf`、`claude-code`……）。
    pub agent_id: String,
    /// agent 那边的 ACP 会话编号（`session/new` 回的 `sessionId`）；没有不给或 null。
    #[serde(default)]
    pub session_id: Option<String>,
    pub anchor: AskAnchorInput,
    #[serde(default)]
    pub messages: Vec<AskMessageInput>,
}

/// PATCH /api/v1/documents/:document_id/ask-threads/:thread_id：给了的才改。不认识的字段 400。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchAskThreadInput {
    #[serde(default)]
    pub agent_id: Option<String>,
    /// 不给 = 不改；null 或空串 = 清掉；字符串 = 换成它。
    #[serde(default, deserialize_with = "present_or_null")]
    pub session_id: Option<Option<String>>,
    /// 整份问答（换掉原来的全部）；标题跟着重算。
    #[serde(default)]
    pub messages: Option<Vec<AskMessageInput>>,
}

/// 字段在就是 `Some`（null 是 `Some(None)`），不在由 `#[serde(default)]` 给 `None`。
fn present_or_null<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(deserializer).map(Some)
}

/// GET /api/v1/documents/:document_id/ask-threads：书上的提问（不带问答正文），最近改过的在前。
#[derive(Debug, Serialize)]
pub struct AskThreadListView {
    pub threads: Vec<AskThreadRecord>,
}

/// 一次提问连同问答：读一次、建、改都回它。
#[derive(Debug, Serialize)]
pub struct AskThreadView {
    #[serde(flatten)]
    pub thread: AskThreadRecord,
    pub messages: Vec<AskMessageRecord>,
}

#[derive(Debug, Serialize)]
pub struct AskThreadDeleteResultView {
    pub thread_id: String,
    pub deleted: bool,
}

/// `DELETE /api/v1/documents/:id` 的查询参数。不认识的参数 400（拼错的 `force` 不会悄悄变成不强删）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteDocumentQuery {
    /// 名下运行中的任务先取消再删。
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Serialize)]
pub struct DocumentDeleteResultView {
    pub deleted: bool,
    pub document_id: String,
    pub removed_jobs: Vec<String>,
    pub removed_paths: Vec<String>,
}

/// POST /api/v1/book-folder/export 的请求体：`document_ids` 不给（或空）就导出整个书库，并删掉已经不在书库里的书的文件夹。
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BookFolderExportInput {
    #[serde(default)]
    pub document_ids: Vec<String>,
}

/// 导出书文件夹的结果。
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct BookFolderExportView {
    /// 书文件夹所在的目录（`<数据目录>/books`）。
    pub root: String,
    /// 这次处理了几本书。
    pub documents: u32,
    /// 重新写了的。
    pub exported: u32,
    /// 和上次导出一样、没动的。
    pub unchanged: u32,
    /// 没有可导出的内容（还没识别）的。
    pub empty: u32,
    /// 删掉的文件夹（书删了、书名改了留下的旧文件夹、或者已经没有内容）。
    pub removed: u32,
    pub failed: Vec<BookFolderExportFailure>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct BookFolderExportFailure {
    pub document_id: String,
    pub message: String,
}
