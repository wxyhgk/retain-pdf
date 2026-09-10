use serde::{Deserialize, Serialize};

fn default_documents_limit() -> u32 {
    50
}

/// 文档:图书馆一等公民,document_id = sha256(文件字节)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentRecord {
    pub document_id: String,
    pub title: String,
    /// 当前标题的来源；旧记录默认为 filename。
    #[serde(default = "default_document_title_source")]
    pub title_source: String,
    /// 用户手工修改标题后锁定，自动元数据建议不得覆盖。
    #[serde(default)]
    pub title_locked: bool,
    pub authors_json: String,
    pub year: Option<i64>,
    pub doi: String,
    pub source_filename: String,
    pub page_count: u32,
    pub bytes: u64,
    pub active_job_id: Option<String>,
    /// 当前已提交的 Agent 文档版本；为空表示仍使用原始上传。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_version_id: Option<String>,
    pub reading_status: String,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub updated_at: String,
    pub tags: Vec<String>,
    /// 源 PDF 下载 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_pdf_url: String,
    /// 封面图 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cover_url: String,
    /// 缩略图 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thumbnail_url: String,
}

fn default_document_title_source() -> String {
    "filename".to_string()
}

/// 收藏:锚点 = (document_id, job_id, page_idx, block_id[, 选区]) + 引文快照。
/// job_id 标记锚点所在的块空间版本;被引用的 job 不允许单独删除。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FavoriteRecord {
    pub favorite_id: String,
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    pub kind: String,
    pub quote_text: String,
    pub translated_quote_text: String,
    pub note: String,
    /// 图片附件(assets.asset_id,内容寻址);空串 = 纯文字收藏
    #[serde(default)]
    pub asset_id: String,
    /// 截图剪裁矩形几何(前端坐标系,整存整取)
    #[serde(default)]
    pub rect_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// 内容寻址的二进制资产(收藏截图等);文件本体在 data/assets/<2>/<hash>。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub asset_id: String,
    pub mime: String,
    pub bytes: u64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: String,
}

/// AI 问答会话。document_id 为空 = 全库问答。
/// head_id: 当前可见分支的叶消息 id(空 = 用 max(seq) 推断)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationRecord {
    pub conversation_id: String,
    pub title: String,
    pub document_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub message_count: i64,
    /// 当前可见叶;空字符串表示未显式设置。
    #[serde(default)]
    pub head_id: String,
}

/// 会话消息。citations_json 是软锚点快照:job 删除后跳转失效但内容不丢。
/// parent_id: 树边;空 = 根。同 parent 的多条为分支兄弟(重试/编辑)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageRecord {
    pub message_id: String,
    pub conversation_id: String,
    pub seq: i64,
    pub role: String,
    pub content: String,
    pub citations_json: String,
    pub tool_trace_json: String,
    pub model: String,
    pub created_at: String,
    /// 父消息 id;空字符串 = 根节点。
    #[serde(default)]
    pub parent_id: String,
}

/// 分类文件夹(合集)。v1 只用扁平结构展示,parent_id 为未来嵌套子分类预留
/// (建表时就规划好,当前恒为 None,不是本次要拆的技术债)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionRecord {
    pub collection_id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    /// 该文件夹当前文档数;只有列表接口才会填,单条查询恒为 0。
    #[serde(default)]
    pub document_count: i64,
}

/// blocks_fts 的一行(派生索引,可随时由任务产物重建)。
#[derive(Debug, Clone)]
pub struct FtsBlockRow {
    pub page_idx: i64,
    pub block_id: String,
    pub source_text: String,
    pub translated_text: String,
}

/// 全文检索命中:带完整锚点,前端可跳转阅读器原位。
#[derive(Debug, Serialize, Clone)]
pub struct BlockSearchHit {
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub source_snippet: String,
    pub translated_snippet: String,
}

/// GET /api/v1/documents 查询参数。
#[derive(Debug, Deserialize)]
pub struct ListDocumentsQuery {
    #[serde(default = "default_documents_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    pub reading_status: Option<String>,
    pub tag: Option<String>,
    pub collection_id: Option<String>,
    /// 按任意 job_id(含历史 run)直查其所属文档,前端无需再扫列表反查
    pub job_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DocumentListView {
    pub documents: Vec<DocumentRecord>,
    /// Number of documents matching the filters before pagination.
    pub total: u64,
}

/// PATCH /api/v1/documents/:id
#[derive(Debug, Deserialize)]
pub struct PatchDocumentInput {
    pub title: Option<String>,
    pub reading_status: Option<String>,
    pub tags: Option<Vec<String>>,
}

fn default_metadata_suggestion_fields() -> Vec<String> {
    vec!["title".to_string()]
}

fn default_metadata_suggestion_limit() -> u32 {
    20
}

/// POST /api/v1/documents/:id/metadata-suggestions
#[derive(Debug, Deserialize)]
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

/// GET /api/v1/documents/:id/metadata-suggestions
#[derive(Debug, Deserialize)]
pub struct ListDocumentMetadataSuggestionsQuery {
    #[serde(default = "default_metadata_suggestion_limit")]
    pub limit: u32,
}

/// POST /api/v1/documents/:id/metadata-suggestions/:suggestion_id/apply
#[derive(Debug, Default, Deserialize)]
pub struct ApplyDocumentMetadataSuggestionInput {
    /// 可选的文档版本护栏；不匹配时返回 409。
    #[serde(default)]
    pub expected_document_updated_at: Option<String>,
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
}

#[derive(Debug, Serialize)]
pub struct DocumentMetadataSuggestionApplyView {
    pub suggestion: DocumentMetadataSuggestionView,
    pub document: DocumentRecord,
}

/// POST /api/v1/favorites
#[derive(Debug, Deserialize)]
pub struct CreateFavoriteInput {
    /// 可缺省:给了 job_id 时后端自动解析所属文档(历史 run 也能收藏)
    #[serde(default)]
    pub document_id: String,
    /// 锚点所在块空间;缺省用文档当前 active_job_id
    pub job_id: Option<String>,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    #[serde(default)]
    pub kind: Option<String>,
    pub quote_text: String,
    #[serde(default)]
    pub translated_quote_text: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    /// 图片附件:先 POST /api/v1/assets 拿 asset_id 再挂上(kind 建议 figure)
    #[serde(default)]
    pub asset_id: Option<String>,
    /// 截图剪裁矩形几何(前端坐标系原样存)
    #[serde(default)]
    pub rect_json: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListFavoritesQuery {
    pub document_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteListView {
    pub favorites: Vec<FavoriteRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchFavoriteInput {
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

fn default_search_limit() -> u32 {
    crate::config::limits::DEFAULT_LIST_LIMIT
}

/// GET /api/v1/search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_search_limit")]
    pub limit: u32,
    /// 限定单文档（阅读器 / AI 整本问答）；空 = 全库
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResultView {
    pub query: String,
    pub hits: Vec<BlockSearchHit>,
}

// --- conversations ---

#[derive(Debug, Deserialize)]
pub struct CreateConversationInput {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub document_id: String,
}

fn default_conversations_limit() -> u32 {
    50
}

#[derive(Debug, Deserialize)]
pub struct ListConversationsQuery {
    #[serde(default = "default_conversations_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    /// 按文档过滤;空 = 全部。
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationListView {
    pub conversations: Vec<ConversationRecord>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct ConversationDetailView {
    #[serde(flatten)]
    pub conversation: ConversationRecord,
    pub messages: Vec<MessageRecord>,
}

#[derive(Debug, Deserialize)]
pub struct AppendMessageInput {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub citations_json: String,
    #[serde(default)]
    pub tool_trace_json: String,
    #[serde(default)]
    pub model: String,
    /// 父消息 id;省略/空 = 挂到当前 head(线性续写)。
    #[serde(default)]
    pub parent_id: String,
    /// 客户端稳定 id(与 assistant-ui store id 对齐);空则服务端生成。
    #[serde(default)]
    pub message_id: String,
    /// 追加后是否把 head 指到本条;默认 true。
    #[serde(default = "default_true")]
    pub set_head: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct PatchConversationInput {
    /// 切换可见分支叶节点。
    #[serde(default)]
    pub head_id: String,
    #[serde(default)]
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct ForkMessageInput {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub parent_id: String,
    #[serde(default)]
    pub message_id: String,
    #[serde(default)]
    pub citations_json: String,
    #[serde(default)]
    pub tool_trace_json: String,
    #[serde(default)]
    pub model: String,
}

#[derive(Debug, Deserialize)]
pub struct ForkConversationInput {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub document_id: String,
    #[serde(default)]
    pub messages: Vec<ForkMessageInput>,
}

#[derive(Debug, Serialize)]
pub struct ConversationMutationResult {
    pub deleted: bool,
}

// --- collections ---

#[derive(Debug, Deserialize)]
pub struct CreateCollectionInput {
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionListView {
    pub collections: Vec<CollectionRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchCollectionInput {
    pub name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
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
