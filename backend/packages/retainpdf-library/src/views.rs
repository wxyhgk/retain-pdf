//! 书库接口的请求和返回类型：文档、元数据建议、全文检索、文件夹（`/api/v1/documents`、`/search`、
//! `/collections`）。2026-10-18 从核心包挪过来；书架（`/api/v1/library/books`）的类型 2026-10-22 跟接口一起删了，
//! AI 对话（`/ai/conversations`）的 2026-11-03 跟 AI 服务一起删了。
//! 库里存的记录（`DocumentRecord` 这些）还在核心包，数据库层要用。

use retainpdf_core::models::api::{
    BlockSearchHit, CollectionRecord, DocumentRecord,
};
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::request::CreateJobInput;
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

/// GET /api/v1/documents 查询参数。不认识的参数 400（2026-10-22 起；标签 `tag` 早已删掉）。
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
            .map_err(|error| AppError::bad_request(format!("invalid job payload: {error}")))?;
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
