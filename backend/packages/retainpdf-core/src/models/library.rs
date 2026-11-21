//! 书库在库里存的记录（文档、资源、对话、文件夹、全文检索行）。接口的请求、返回类型在书库包
//! （retainpdf-library 的 `views`）。

use serde::{Deserialize, Serialize};

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
    /// 源 PDF 下载 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_pdf_url: String,
    /// 封面图 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cover_url: String,
    /// 缩略图 URL（列表/详情由 API 层填充，不入库）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thumbnail_url: String,
    /// 有没有任何成功的、带译文（非纯 OCR）的任务 —— 「这本书能不能对照阅读」。
    ///
    /// 和 `active_job_id` 指向的任务状态无关：重新翻译 / 重新渲染在跑或失败时，旧译文照样
    /// 能读（阅读器按全部成功任务合并）。读时由 SQL 现算（不入库），只查任务表，不解析 PDF；
    /// 不保证输出 PDF 仍在磁盘上，那由阅读入口 `/documents/:id/reading` 兜底。
    #[serde(default)]
    pub has_translation: bool,
    /// 书上的标签，按名字排（v37 起；没有是空数组）。
    #[serde(default)]
    pub tags: Vec<DocumentTag>,
}

/// 书上的一个标签（`DocumentRecord.tags` 里的一项）。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DocumentTag {
    pub tag_id: String,
    pub name: String,
    /// 空 = 不设颜色；有就是 `#RRGGBB`。
    pub color: String,
}

/// 一个标签（v37）。任何条目都能打，现在接口里只有书。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TagRecord {
    pub tag_id: String,
    pub name: String,
    pub color: String,
    /// 打了这个标签的书有几本；每次读时现算。
    pub document_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn default_document_title_source() -> String {
    "filename".to_string()
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
    /// 该文件夹当前文档数;每次读时由 SQL 现算(`COLLECTION_COLUMNS`),单条和列表都是。
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

// --- collections ---
