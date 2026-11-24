//! 译文版本（v30）：一本书的几份译文，前端能切换。数据规则见迁移 `v30_translation_versions.sql`。
//!
//! - 版本列表：每个版本的名字（用户起的，没起就按翻译设置生成）、状态、覆盖哪些页、改过几处、是不是当前版本；
//! - 当前版本：书记着用户选的版本，没选过是自动（逐页取最新）；新译文翻完时自动模式自然跟着最新走，选过的不动；
//! - 读一个版本：这个版本的任务，加上它的来源版本链（只重翻一部分页时其余页沿用来源版本），见 `merge::reading`。

use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_data::db::{Db, TranslationVersionRecord};

use crate::merge::page_count::book_page_count;
use crate::merge::reading::{document_merge_sources, ReadingSelection};

/// 切到一个已隐藏的版本：409 的 `error.details.reason`（先 `PATCH … {hidden: false}` 恢复再选）。
pub(crate) const VERSION_HIDDEN: &str = "version_hidden";

/// 来源版本链最多往上找几层（防环、防异常数据）。
const MAX_CHAIN: usize = 32;

/// 只翻一部分页时的来源版本：用户选了当前版本就是它，自动模式取最新的（没隐藏的）版本。
pub(crate) fn reading_base_version(db: &Db, document_id: &str) -> Result<Option<String>, AppError> {
    let versions = db.list_translation_versions(document_id, false)?;
    if let Some(current) = db.document_current_translation_version(document_id)? {
        if versions.iter().any(|version| version.version_id == current) {
            return Ok(Some(current));
        }
    }
    Ok(versions.last().map(|version| version.version_id.clone()))
}

/// 这本书的这个版本，404 如果不存在或不属于这本书。
fn version_of_document(db: &Db, document_id: &str, version_id: &str) -> Result<TranslationVersionRecord, AppError> {
    db.get_translation_version(version_id)?
        .filter(|version| version.document_id == document_id)
        .ok_or_else(|| AppError::not_found(format!("translation version not found: {version_id}")))
}

/// 读这个版本要用的任务，分层：最底下的来源版本在前，这个版本在最后。
pub(crate) fn version_selection(db: &Db, document_id: &str, version_id: &str) -> Result<ReadingSelection, AppError> {
    let mut layers = Vec::new();
    let mut seen = BTreeSet::new();
    let mut next = Some(version_of_document(db, document_id, version_id)?);
    while let Some(version) = next.take() {
        if !seen.insert(version.version_id.clone()) || layers.len() >= MAX_CHAIN {
            break;
        }
        next = match version.base_version_id.as_deref() {
            Some(base) => db.get_translation_version(base)?.filter(|base| base.document_id == document_id),
            None => None,
        };
        layers.push(version.job_ids);
    }
    layers.reverse();
    Ok(ReadingSelection::Version { layers })
}

/// 自动模式：隐藏版本的任务不用。
pub(crate) fn auto_selection(db: &Db, document_id: &str) -> Result<ReadingSelection, AppError> {
    Ok(ReadingSelection::Auto { excluded: db.hidden_translation_version_jobs(document_id)? })
}

// ── 接口 ────────────────────────────────────────────────────────────────────

/// `GET /documents/:id/reading` 的查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DocumentReadingQuery {
    /// 读哪个译文版本；`auto` = 自动（逐页取最新）；不给 = 书的当前版本。
    #[serde(default)]
    pub version: Option<String>,
}

/// `GET /documents/:id/translation-versions` 的查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationVersionsQuery {
    /// 带上隐藏的版本（默认不带）。
    #[serde(default)]
    pub include_hidden: bool,
}

/// `PUT /documents/:id/translation-version`：切换当前版本；`version_id` 为 null 是回到自动。
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetCurrentTranslationVersionInput {
    pub version_id: Option<String>,
}

/// `PATCH /documents/:id/translation-versions/:version_id`：改名、隐藏或恢复。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PatchTranslationVersionInput {
    /// 新名字；空串 = 清掉，回到按翻译设置生成的名字。
    pub label: Option<String>,
    pub hidden: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TranslationVersionView {
    pub version_id: String,
    /// 显示用的名字：用户起的，没起就按翻译设置生成（如「精翻 · qwen3.8-flash」「普通 · deepseek-flash（第 30–40 页）」）。
    pub name: String,
    /// 用户起的名字；没起是空串。
    pub label: String,
    /// translate（整本翻译）/ retranslate（重新翻译）/ backfill（升级时从已有任务回填）。
    pub origin: String,
    /// 只重翻一部分页时，其余页沿用的版本。
    pub base_version_id: Option<String>,
    pub created_at: String,
    pub hidden: bool,
    /// running（还有任务在排队或在跑）/ succeeded / failed / canceled。
    pub status: String,
    pub job_ids: Vec<String>,
    /// 这个版本自己翻了哪些页（1 起，闭区间，连续的并成一段）；不含沿用来源版本的页。
    pub page_ranges: Vec<[u32; 2]>,
    /// 自己就覆盖了整本。
    pub whole_book: bool,
    /// legacy / agent。
    pub engine: String,
    pub model: String,
    /// 另配的审校 / 编辑模型；没配是空串。
    pub reviewer_model: String,
    /// 用户手改过几块。
    pub edited_blocks: usize,
    pub is_current: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TranslationVersionsView {
    pub document_id: String,
    /// 用户选的版本；`None` = 自动（逐页取最新）。
    pub current_version_id: Option<String>,
    /// 选了某个版本、而且有比它新的版本：前端提示「有新版本」。
    pub has_newer: bool,
    /// 从旧到新。
    pub versions: Vec<TranslationVersionView>,
}

pub(crate) fn translation_versions_view(
    db: &Db,
    data_root: &Path,
    document_id: &str,
    source_pdf: Option<&Path>,
    include_hidden: bool,
) -> Result<TranslationVersionsView, AppError> {
    let document = db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let page_count = book_page_count(source_pdf, document.page_count);
    let jobs = db.list_jobs_for_document(document_id, 500, 0)?;
    let sources = document_merge_sources(&jobs, data_root);
    let current = db.document_current_translation_version(document_id)?;
    let records = db.list_translation_versions(document_id, include_hidden)?;
    let versions: Vec<TranslationVersionView> = records
        .into_iter()
        .map(|record| {
            let own_jobs: Vec<&JobSnapshot> = record.job_ids.iter().filter_map(|id| jobs.iter().find(|job| &job.job_id == id)).collect();
            let pages: BTreeSet<u32> = sources
                .iter()
                .filter(|source| record.job_ids.contains(&source.ranked.rank.job_id))
                .flat_map(|source| source.ranked.pages.iter().copied())
                .collect();
            let first = own_jobs.iter().find(|job| job.workflow != retainpdf_core::models::domain::WorkflowKind::Render).or(own_jobs.first());
            let (engine, model, reviewer_model) = first
                .map(|job| {
                    (job.translation_engine().to_string(), job.translation_model().to_string(), job.translation_reviewer_model().to_string())
                })
                .unwrap_or_default();
            let page_ranges = ranges(&pages);
            let whole_book = page_count > 0 && pages.len() as u32 == page_count;
            let name = if record.label.trim().is_empty() {
                generated_name(first.copied(), &page_ranges, whole_book)
            } else {
                record.label.clone()
            };
            TranslationVersionView {
                is_current: current.as_deref() == Some(record.version_id.as_str()),
                version_id: record.version_id,
                name,
                label: record.label,
                origin: record.origin,
                base_version_id: record.base_version_id,
                created_at: record.created_at,
                hidden: record.hidden_at.is_some(),
                status: status_of(&own_jobs),
                job_ids: record.job_ids,
                page_ranges,
                whole_book,
                engine,
                model,
                reviewer_model,
                edited_blocks: own_jobs.iter().map(|job| retainpdf_jobs::user_edited_block_count(data_root, job)).sum(),
            }
        })
        .collect();
    // 列表已经从旧到新：当前版本后面还有没隐藏的就是有新版本
    let has_newer = versions
        .iter()
        .position(|version| version.is_current)
        .is_some_and(|index| versions[index + 1..].iter().any(|version| !version.hidden));
    Ok(TranslationVersionsView {
        document_id: document_id.to_string(),
        current_version_id: versions.iter().find(|version| version.is_current).map(|version| version.version_id.clone()),
        has_newer,
        versions,
    })
}

pub(crate) fn set_current_translation_version(db: &Db, document_id: &str, version_id: Option<&str>) -> Result<(), AppError> {
    db.get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let version_id = version_id.map(str::trim).filter(|id| !id.is_empty());
    if let Some(version_id) = version_id {
        let version = version_of_document(db, document_id, version_id)?;
        if version.hidden_at.is_some() {
            return Err(AppError::conflict_because(
                VERSION_HIDDEN,
                "translation version is hidden; restore it before choosing it",
            ));
        }
    }
    db.set_document_current_translation_version(document_id, version_id)?;
    Ok(())
}

pub(crate) fn patch_translation_version(
    db: &Db,
    document_id: &str,
    version_id: &str,
    input: &PatchTranslationVersionInput,
) -> Result<(), AppError> {
    version_of_document(db, document_id, version_id)?;
    if let Some(label) = input.label.as_deref() {
        let label = label.trim();
        if label.chars().count() > 80 {
            return Err(AppError::bad_request("label is longer than 80 characters"));
        }
        db.set_translation_version_label(version_id, label)?;
    }
    if let Some(hidden) = input.hidden {
        db.set_translation_version_hidden(version_id, hidden)?;
    }
    Ok(())
}

// ── 小工具 ──────────────────────────────────────────────────────────────────

fn status_of(jobs: &[&JobSnapshot]) -> String {
    let statuses: Vec<&JobStatusKind> = jobs.iter().map(|job| &job.status).collect();
    let status = if statuses.iter().any(|s| matches!(s, JobStatusKind::Queued | JobStatusKind::Running)) {
        "running"
    } else if statuses.iter().any(|s| matches!(s, JobStatusKind::Failed)) {
        "failed"
    } else if !statuses.is_empty() && statuses.iter().all(|s| matches!(s, JobStatusKind::Canceled)) {
        "canceled"
    } else {
        "succeeded"
    };
    status.to_string()
}

fn ranges(pages: &BTreeSet<u32>) -> Vec<[u32; 2]> {
    let mut out: Vec<[u32; 2]> = Vec::new();
    for &page in pages {
        match out.last_mut() {
            Some(last) if last[1] + 1 == page => last[1] = page,
            _ => out.push([page, page]),
        }
    }
    out
}

/// 「精翻 · qwen3.8-flash」「统一术语 · deepseek-flash（第 30–40 页）」。
fn generated_name(job: Option<&JobSnapshot>, page_ranges: &[[u32; 2]], whole_book: bool) -> String {
    let Some(job) = job else {
        return "译文".to_string();
    };
    let preparation = job.translation_preparation();
    let kind = if job.translation_engine() == "agent" {
        "精翻"
    } else if preparation.starts_with("terms") || preparation == "editorial" {
        "统一术语"
    } else {
        "普通"
    };
    let model = job.translation_model().trim();
    let mut name = if model.is_empty() { kind.to_string() } else { format!("{kind} · {model}") };
    if !whole_book && !page_ranges.is_empty() {
        let pages: Vec<String> = page_ranges
            .iter()
            .map(|[a, b]| if a == b { a.to_string() } else { format!("{a}–{b}") })
            .collect();
        name.push_str(&format!("（第 {} 页）", pages.join("、")));
    }
    name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_ranges_merge_consecutive_pages() {
        let pages: BTreeSet<u32> = [1, 2, 3, 7, 9, 10].into_iter().collect();
        assert_eq!(ranges(&pages), vec![[1, 3], [7, 7], [9, 10]]);
        assert!(ranges(&BTreeSet::new()).is_empty());
    }
}
