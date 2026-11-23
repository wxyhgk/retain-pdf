//! 服务商错误码目录（2026-11-23）：各家 OCR、翻译模型服务商官方文档里的错误码，给用户的提示，
//! RetainPDF 现在怎么处理，以及上游错误大类 → 任务失败码（`failure_code`）的对照。
//!
//! 数据的唯一来源是包里的 `error-codes/` 目录（`ocr/<厂商>.json`、`llm/<厂商>.json`、`categories.json`、
//! `failure-codes.json`），编译时嵌入；形状由契约 `provider-error-codes.v1` 钉住。
//! 接口 `GET /api/v1/providers/error-codes` 和文档 `docs/reference/error-codes/`（rust_api 的
//! `api_tests/provider_error_codes.rs` 生成）都读这一份。
//!
//! 只是查表：这里不改任何重试、分类行为。数据里标了 `gap` 的条目由各自的修复分支去改代码，改完再改数据。

use std::sync::OnceLock;

use retainpdf_api_base::error::AppError;
use serde::{Deserialize, Serialize};

pub const PROVIDER_ERROR_CODES_SCHEMA: &str = "provider-error-codes.v1";

/// 厂商数据文件（相对 `error-codes/`），顺序就是接口返回的顺序：先 OCR，后翻译模型。
const VENDOR_FILES: &[(&str, &str)] = &[
    ("ocr/paddle.json", include_str!("../error-codes/ocr/paddle.json")),
    ("ocr/mineru.json", include_str!("../error-codes/ocr/mineru.json")),
    ("ocr/glm_ocr.json", include_str!("../error-codes/ocr/glm_ocr.json")),
    ("llm/openai.json", include_str!("../error-codes/llm/openai.json")),
    ("llm/anthropic.json", include_str!("../error-codes/llm/anthropic.json")),
    ("llm/deepseek.json", include_str!("../error-codes/llm/deepseek.json")),
    ("llm/zhipu.json", include_str!("../error-codes/llm/zhipu.json")),
    ("llm/qwen.json", include_str!("../error-codes/llm/qwen.json")),
    ("llm/opencode.json", include_str!("../error-codes/llm/opencode.json")),
];
const CATEGORIES_FILE: &str = include_str!("../error-codes/categories.json");
const FAILURE_CODES_FILE: &str = include_str!("../error-codes/failure-codes.json");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Ocr,
    Llm,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ocr => "ocr",
            Self::Llm => "llm",
        }
    }
}

/// 上游错误大类（固定取值，契约 `ProviderErrorCategoryId`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorCategoryId {
    Auth,
    Permission,
    Region,
    Billing,
    Quota,
    RateLimit,
    Overloaded,
    Server,
    Timeout,
    InvalidRequest,
    ContextLength,
    ContentFilter,
    ModelNotFound,
    Unsupported,
    File,
    Other,
}

impl ProviderErrorCategoryId {
    pub const ALL: [Self; 16] = [
        Self::Auth,
        Self::Permission,
        Self::Region,
        Self::Billing,
        Self::Quota,
        Self::RateLimit,
        Self::Overloaded,
        Self::Server,
        Self::Timeout,
        Self::InvalidRequest,
        Self::ContextLength,
        Self::ContentFilter,
        Self::ModelNotFound,
        Self::Unsupported,
        Self::File,
        Self::Other,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth => "auth",
            Self::Permission => "permission",
            Self::Region => "region",
            Self::Billing => "billing",
            Self::Quota => "quota",
            Self::RateLimit => "rate_limit",
            Self::Overloaded => "overloaded",
            Self::Server => "server",
            Self::Timeout => "timeout",
            Self::InvalidRequest => "invalid_request",
            Self::ContextLength => "context_length",
            Self::ContentFilter => "content_filter",
            Self::ModelNotFound => "model_not_found",
            Self::Unsupported => "unsupported",
            Self::File => "file",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HandlingStatus {
    Ok,
    Gap,
    Fixing,
    NotApplicable,
}

impl HandlingStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Gap => "gap",
            Self::Fixing => "fixing",
            Self::NotApplicable => "not_applicable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HandlingAction {
    Retry,
    FailFast,
    StopTranslation,
    AutoAdjust,
    FailBlock,
    NotApplicable,
}

impl HandlingAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Retry => "retry",
            Self::FailFast => "fail_fast",
            Self::StopTranslation => "stop_translation",
            Self::AutoAdjust => "auto_adjust",
            Self::FailBlock => "fail_block",
            Self::NotApplicable => "not_applicable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GapPriority {
    High,
    Medium,
    Low,
}

impl GapPriority {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::High => "high",
            Self::Medium => "medium",
            Self::Low => "low",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailureProducer {
    Python,
    Rust,
    Both,
}

/// `GET /api/v1/providers/error-codes` 的筛选条件。不认识的参数 400；`kind` 只能是 `ocr` / `llm`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorCodesQuery {
    #[serde(default)]
    pub kind: Option<ProviderKind>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub http_status: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorCategory {
    pub id: ProviderErrorCategoryId,
    pub label_zh: String,
    pub description_zh: String,
    pub retryable: bool,
    pub user_hint_zh: String,
    /// 第一个是主名（Python 拼法），后面是同义的另一种拼法（Rust 兜底）。
    pub failure_codes: Vec<String>,
    pub note_zh: Option<String>,
}

/// 数据文件 `failure-codes.json` 的一行。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RetainpdfFailureCodeRecord {
    pub failure_code: String,
    pub producer: FailureProducer,
    pub summary_zh: String,
    pub retryable: bool,
    pub issues: Vec<u32>,
    pub note_zh: Option<String>,
}

/// 接口里的失败码：数据文件的一行，加上恢复目录（retainpdf-core `job_failure_catalogue`）里的续跑方式。
#[derive(Debug, Clone, Serialize)]
pub struct RetainpdfFailureCodeView {
    #[serde(flatten)]
    pub record: RetainpdfFailureCodeRecord,
    pub resume_from: Option<&'static str>,
    pub recovery_hint: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorSource {
    pub title: String,
    pub url: String,
    pub fetched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorIssue {
    pub number: u32,
    pub summary_zh: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RetainpdfHandling {
    pub status: HandlingStatus,
    pub action: HandlingAction,
    pub failure_code: Option<String>,
    pub summary_zh: String,
    pub gap_zh: Option<String>,
    pub priority: Option<GapPriority>,
    pub code_paths: Vec<String>,
    pub issues: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorEntry {
    pub id: String,
    pub code: Option<String>,
    pub aliases: Vec<String>,
    pub http_status: Vec<u16>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub category: ProviderErrorCategoryId,
    pub retryable: bool,
    pub meaning_zh: String,
    pub meaning_en: String,
    pub user_hint_zh: String,
    pub source_url: String,
    pub retainpdf_handling: RetainpdfHandling,
}

impl ProviderErrorEntry {
    /// `code` 筛选：精确匹配码、别名或编号。
    pub fn matches_code(&self, code: &str) -> bool {
        self.code.as_deref() == Some(code) || self.aliases.iter().any(|alias| alias == code) || self.id == code
    }
}

/// 一家服务商（一个数据文件）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderErrorVendor {
    pub id: String,
    pub label: String,
    pub kind: ProviderKind,
    pub hosts: Vec<String>,
    pub sources: Vec<ProviderErrorSource>,
    pub error_shape_zh: String,
    pub how_to_distinguish_zh: Vec<String>,
    pub handling_summary_zh: String,
    pub notes_zh: Vec<String>,
    pub issues: Vec<ProviderErrorIssue>,
    pub related_docs: Vec<String>,
    pub entries: Vec<ProviderErrorEntry>,
}

/// `GET /api/v1/providers/error-codes` 的返回（契约 `ProviderErrorCatalogueView`）。
#[derive(Debug, Clone, Serialize)]
pub struct ProviderErrorCatalogueView {
    pub schema: &'static str,
    pub categories: Vec<ProviderErrorCategory>,
    pub failure_codes: Vec<RetainpdfFailureCodeView>,
    pub vendors: Vec<ProviderErrorVendor>,
}

struct Catalogue {
    categories: Vec<ProviderErrorCategory>,
    failure_codes: Vec<RetainpdfFailureCodeRecord>,
    vendors: Vec<ProviderErrorVendor>,
}

fn parse<T: for<'de> Deserialize<'de>>(name: &str, text: &str) -> Result<T, String> {
    serde_json::from_str(text).map_err(|error| format!("error-codes/{name}: {error}"))
}

fn load() -> Result<Catalogue, String> {
    let categories: Vec<ProviderErrorCategory> = parse("categories.json", CATEGORIES_FILE)?;
    let failure_codes: Vec<RetainpdfFailureCodeRecord> = parse("failure-codes.json", FAILURE_CODES_FILE)?;
    let mut vendors = Vec::with_capacity(VENDOR_FILES.len());
    for (name, text) in VENDOR_FILES {
        let vendor: ProviderErrorVendor = parse(name, text)?;
        let expected = format!("{}/{}.json", vendor.kind.as_str(), vendor.id);
        if *name != expected {
            return Err(format!("error-codes/{name}: 文件位置和 kind/id 对不上（应为 {expected}）"));
        }
        let mut ids = std::collections::HashSet::new();
        for entry in &vendor.entries {
            if !ids.insert(entry.id.as_str()) {
                return Err(format!("error-codes/{name}: 条目编号重复 {}", entry.id));
            }
        }
        vendors.push(vendor);
    }
    Ok(Catalogue { categories, failure_codes, vendors })
}

fn catalogue() -> Result<&'static Catalogue, AppError> {
    static CATALOGUE: OnceLock<Result<Catalogue, String>> = OnceLock::new();
    CATALOGUE
        .get_or_init(load)
        .as_ref()
        .map_err(|error| AppError::internal(format!("provider error code catalogue is broken: {error}")))
}

/// 按筛选条件给出目录。`categories`、`failure_codes` 总是全量；厂商不认识时 `vendors` 为空；
/// 带了 `code` / `http_status` 时只留命中的条目，没有命中条目的厂商不返回。
pub fn provider_error_catalogue(query: &ProviderErrorCodesQuery) -> Result<ProviderErrorCatalogueView, AppError> {
    let catalogue = catalogue()?;
    let code = query.code.as_deref().map(str::trim).filter(|value| !value.is_empty());
    let provider = query.provider.as_deref().map(str::trim).filter(|value| !value.is_empty());
    let filters_entries = code.is_some() || query.http_status.is_some();
    let vendors = catalogue
        .vendors
        .iter()
        .filter(|vendor| query.kind.is_none_or(|kind| vendor.kind == kind))
        .filter(|vendor| provider.is_none_or(|provider| vendor.id == provider))
        .filter_map(|vendor| {
            let mut vendor = vendor.clone();
            vendor.entries.retain(|entry| {
                code.is_none_or(|code| entry.matches_code(code))
                    && query.http_status.is_none_or(|status| entry.http_status.contains(&status))
            });
            (!filters_entries || !vendor.entries.is_empty()).then_some(vendor)
        })
        .collect();
    let failure_codes = catalogue
        .failure_codes
        .iter()
        .map(|record| {
            let recovery = retainpdf_core::job_failure_catalogue::recovery_for(&record.failure_code);
            RetainpdfFailureCodeView {
                record: record.clone(),
                resume_from: recovery.resume_from.map(|stage| stage.as_str()),
                recovery_hint: recovery.hint,
            }
        })
        .collect();
    Ok(ProviderErrorCatalogueView {
        schema: PROVIDER_ERROR_CODES_SCHEMA,
        categories: catalogue.categories.clone(),
        failure_codes,
        vendors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn full() -> ProviderErrorCatalogueView {
        provider_error_catalogue(&ProviderErrorCodesQuery::default()).expect("catalogue loads")
    }

    /// 目录里每个文件都嵌进来了：多放一个文件忘了登记、或者登记了文件被删，都在这里红。
    #[test]
    fn every_data_file_is_embedded() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("error-codes");
        let mut on_disk = Vec::new();
        for kind in ["ocr", "llm"] {
            for entry in std::fs::read_dir(root.join(kind)).expect("read kind dir") {
                let name = entry.unwrap().file_name().to_string_lossy().into_owned();
                on_disk.push(format!("{kind}/{name}"));
            }
        }
        on_disk.sort();
        let mut embedded: Vec<String> = VENDOR_FILES.iter().map(|(name, _)| name.to_string()).collect();
        embedded.sort();
        assert_eq!(on_disk, embedded);
        let mut top: Vec<String> = std::fs::read_dir(&root)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        top.sort();
        assert_eq!(top, vec!["categories.json", "failure-codes.json", "llm", "ocr"]);
    }

    #[test]
    fn catalogue_lists_every_vendor_in_order() {
        let ids: Vec<String> = full().vendors.into_iter().map(|vendor| vendor.id).collect();
        assert_eq!(
            ids,
            vec!["paddle", "mineru", "glm_ocr", "openai", "anthropic", "deepseek", "zhipu", "qwen", "opencode"]
        );
    }

    /// 每个大类都在 categories.json 里有一行（且只有一行）。
    #[test]
    fn every_category_is_described_once() {
        let view = full();
        let listed: Vec<ProviderErrorCategoryId> = view.categories.iter().map(|category| category.id).collect();
        assert_eq!(listed, ProviderErrorCategoryId::ALL.to_vec());
    }

    /// 失败码表和恢复目录对得上：恢复目录里的每个码都有说明，说明里的码（除了 Rust 兜底 unknown）都在恢复目录里；
    /// 大类对照、每条的 retainpdf_handling.failure_code 只能写这张表里的码。
    #[test]
    fn failure_codes_match_the_recovery_catalogue() {
        let view = full();
        let described: std::collections::BTreeSet<&str> =
            view.failure_codes.iter().map(|code| code.record.failure_code.as_str()).collect();
        assert_eq!(described.len(), view.failure_codes.len(), "失败码表有重复");
        let catalogued: std::collections::BTreeSet<&str> =
            retainpdf_core::job_failure_catalogue::catalogued_failure_codes().collect();
        let missing: Vec<_> = catalogued.difference(&described).collect();
        assert!(missing.is_empty(), "恢复目录里的码没有写进 failure-codes.json：{missing:?}");
        let extra: Vec<_> = described.difference(&catalogued).filter(|code| **code != "unknown").collect();
        assert!(extra.is_empty(), "failure-codes.json 里有恢复目录没有的码：{extra:?}");
        for category in &view.categories {
            assert!(!category.failure_codes.is_empty(), "{:?} 没有对照的失败码", category.id);
            for code in &category.failure_codes {
                assert!(described.contains(code.as_str()), "{:?} 对照到不存在的失败码 {code}", category.id);
            }
        }
        for vendor in &view.vendors {
            for entry in &vendor.entries {
                if let Some(code) = &entry.retainpdf_handling.failure_code {
                    assert!(described.contains(code.as_str()), "{}/{} 写了不存在的失败码 {code}", vendor.id, entry.id);
                }
            }
        }
    }

    /// 处理状态和缺口说明一致：有缺口要写缺口和优先级，没缺口不写。
    #[test]
    fn handling_gaps_are_consistent() {
        for vendor in full().vendors {
            for entry in vendor.entries {
                let handling = &entry.retainpdf_handling;
                let where_ = format!("{}/{}", vendor.id, entry.id);
                match handling.status {
                    HandlingStatus::Gap | HandlingStatus::Fixing => {
                        assert!(handling.gap_zh.as_deref().is_some_and(|gap| !gap.trim().is_empty()), "{where_} 缺 gap_zh");
                        assert!(handling.priority.is_some(), "{where_} 缺 priority");
                    }
                    HandlingStatus::Ok | HandlingStatus::NotApplicable => {
                        assert!(handling.gap_zh.is_none() && handling.priority.is_none(), "{where_} 没缺口却写了 gap_zh/priority");
                    }
                }
                assert!(entry.source_url.starts_with("https://"), "{where_} source_url");
                assert!(!entry.user_hint_zh.trim().is_empty(), "{where_} user_hint_zh");
                for path in &handling.code_paths {
                    assert!(path.starts_with("backend/"), "{where_} code_paths 要相对仓库根：{path}");
                }
            }
        }
    }

    #[test]
    fn filters_narrow_vendors_and_entries() {
        let ocr = provider_error_catalogue(&ProviderErrorCodesQuery { kind: Some(ProviderKind::Ocr), ..Default::default() }).unwrap();
        assert!(ocr.vendors.iter().all(|vendor| vendor.kind == ProviderKind::Ocr));
        assert_eq!(ocr.vendors.len(), 3);

        let one = provider_error_catalogue(&ProviderErrorCodesQuery {
            provider: Some("paddle".into()),
            code: Some("12001".into()),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(one.vendors.len(), 1);
        assert_eq!(one.vendors[0].entries.len(), 1);
        assert_eq!(one.vendors[0].entries[0].category, ProviderErrorCategoryId::Quota);

        // 别名也能查到：百炼兼容模式的小写码
        let alias = provider_error_catalogue(&ProviderErrorCodesQuery { code: Some("invalid_api_key".into()), ..Default::default() }).unwrap();
        let vendors: Vec<&str> = alias.vendors.iter().map(|vendor| vendor.id.as_str()).collect();
        assert_eq!(vendors, vec!["openai", "qwen"]);

        let status = provider_error_catalogue(&ProviderErrorCodesQuery {
            provider: Some("deepseek".into()),
            http_status: Some(402),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(status.vendors[0].entries.len(), 1);
        assert_eq!(status.vendors[0].entries[0].id, "http_402");

        let unknown = provider_error_catalogue(&ProviderErrorCodesQuery { provider: Some("nobody".into()), ..Default::default() }).unwrap();
        assert!(unknown.vendors.is_empty());
        assert_eq!(unknown.categories.len(), 16, "大类总是全量");
    }
}
