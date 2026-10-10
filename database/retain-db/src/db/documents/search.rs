use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::params;

use crate::models::api::{BlockSearchHit, FtsBlockRow};

use super::rows::row_to_search_hit;
use crate::db::Db;

impl Db {
    /// 整体重建某文档的 FTS 行(派生索引,幂等)。
    pub fn replace_document_fts(
        &self,
        document_id: &str,
        job_id: &str,
        rows: &[FtsBlockRow],
    ) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        tx.execute(
            "DELETE FROM blocks_fts WHERE document_id = ?1",
            params![document_id],
        )?;
        for row in rows {
            if row.source_text.trim().is_empty() && row.translated_text.trim().is_empty() {
                continue;
            }
            tx.execute(
                r#"
                INSERT INTO blocks_fts (document_id, job_id, page_idx, block_id, source_text, translated_text)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                "#,
                params![
                    document_id,
                    job_id,
                    row.page_idx,
                    row.block_id,
                    row.source_text,
                    row.translated_text,
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// 按这本书**所有**成功任务重建索引（每页取最新的那个，见 `build_document_fts`）。
    /// 返回写入的行数。
    pub fn rebuild_document_fts(&self, document_id: &str) -> Result<usize> {
        let jobs = self.list_jobs_for_document(document_id, 500, 0)?;
        let groups = build_document_fts(&jobs, &self.data_root);
        self.replace_document_fts_by_job(document_id, &groups)?;
        Ok(groups.iter().map(|(_, rows)| rows.len()).sum())
    }

    /// 整体重建某文档的 FTS 行，行可以来自多个任务（见 `build_document_fts`）。
    pub fn replace_document_fts_by_job(
        &self,
        document_id: &str,
        groups: &[(String, Vec<FtsBlockRow>)],
    ) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM blocks_fts WHERE document_id = ?1", params![document_id])?;
        for (job_id, rows) in groups {
            for row in rows {
                if row.source_text.trim().is_empty() && row.translated_text.trim().is_empty() {
                    continue;
                }
                tx.execute(
                    r#"
                    INSERT INTO blocks_fts (document_id, job_id, page_idx, block_id, source_text, translated_text)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                    "#,
                    params![document_id, job_id, row.page_idx, row.block_id, row.source_text, row.translated_text],
                )?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// 全文检索。trigram 分词要求查询 ≥3 字符,更短的查询回退 LIKE 扫描。
    /// `document_id` 非空时只搜该文档（阅读器 / AI 整本问答）。
    pub fn search_blocks(
        &self,
        query: &str,
        limit: u32,
        document_id: Option<&str>,
    ) -> Result<Vec<BlockSearchHit>> {
        self.search_blocks_for_owner(query, limit, document_id, None)
    }

    /// 同 [`Db::search_blocks`]，`owner` 非空时只搜这个账号的书（多用户模式）。
    pub fn search_blocks_for_owner(
        &self,
        query: &str,
        limit: u32,
        document_id: Option<&str>,
        owner: Option<&str>,
    ) -> Result<Vec<BlockSearchHit>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let doc_filter = document_id.map(str::trim).filter(|s| !s.is_empty());
        let conn = self.connect()?;
        let fts = query.chars().count() >= 3;
        let (select, mut conditions, needle) = if fts {
            (
                "SELECT document_id, job_id, page_idx, block_id, \
                 snippet(blocks_fts, 4, '[', ']', '…', 16), snippet(blocks_fts, 5, '[', ']', '…', 16) \
                 FROM blocks_fts",
                vec!["blocks_fts MATCH ?1".to_string()],
                format!("\"{}\"", query.replace('"', " ")),
            )
        } else {
            (
                "SELECT document_id, job_id, page_idx, block_id, \
                 substr(source_text, 1, 120), substr(translated_text, 1, 120) FROM blocks_fts",
                vec!["(source_text LIKE ?1 OR translated_text LIKE ?1)".to_string()],
                format!("%{}%", query.replace('%', "").replace('_', "")),
            )
        };
        let mut values: Vec<rusqlite::types::Value> = vec![needle.into()];
        if let Some(doc_id) = doc_filter {
            values.push(doc_id.to_string().into());
            conditions.push(format!("document_id = ?{}", values.len()));
        }
        if let Some(owner) = owner {
            values.push(owner.to_string().into());
            conditions.push(format!(
                "document_id IN (SELECT document_id FROM documents WHERE owner_user_id = ?{})",
                values.len()
            ));
        }
        values.push((limit as i64).into());
        let order = if fts { " ORDER BY rank" } else { "" };
        let sql = format!("{select} WHERE {}{order} LIMIT ?{}", conditions.join(" AND "), values.len());
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values), row_to_search_hit)?;
        let mut hits = Vec::new();
        for row in rows {
            hits.push(row?);
        }
        Ok(hits)
    }
}

/// 从任务产物目录构建某文档的 FTS 行:
/// - `ocr/normalized/document.v1.json` 提供 source_text、规范 block_id，
///   以及空文本资产块已有的 caption/search metadata;
/// - `translated/page-*.json` 提供 translated_text,按 (page_idx, block_idx)
///   数字索引对齐(译文 item_id 与规范 block_id 的零填充位数不同,不能按
///   字符串对齐)。
/// 译文缺失时只索引原文。
pub fn build_fts_rows_from_job_dir(job_root: &Path) -> Result<Vec<FtsBlockRow>> {
    build_fts_rows(
        &job_root.join("ocr").join("normalized").join("document.v1.json"),
        &job_root.join("translated"),
    )
}

/// 一份 OCR 文档 + 一个译文目录的索引行。`page_idx` 是 OCR 文档里的本地页号。
pub fn build_fts_rows(normalized_path: &Path, translated_dir: &Path) -> Result<Vec<FtsBlockRow>> {
    let normalized_path = normalized_path.to_path_buf();
    let raw = std::fs::read_to_string(&normalized_path)
        .with_context(|| format!("read {}", normalized_path.display()))?;
    let document: serde_json::Value = serde_json::from_str(&raw)?;
    let asset_catalog = document.get("assets").and_then(|value| value.as_object());

    let mut translated: std::collections::HashMap<(i64, i64), String> =
        std::collections::HashMap::new();
    if let Ok(entries) = std::fs::read_dir(translated_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("page-") || !name.ends_with(".json") {
                continue;
            }
            let Ok(raw) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let Ok(items) = serde_json::from_str::<serde_json::Value>(&raw) else {
                continue;
            };
            for item in items.as_array().map(|a| a.as_slice()).unwrap_or_default() {
                let page_idx = value_as_i64(item.get("page_idx"));
                let block_idx = value_as_i64(item.get("block_idx"));
                let text = item
                    .get("translated_text")
                    .and_then(|value| value.as_str())
                    .unwrap_or("");
                if let (Some(page_idx), Some(block_idx)) = (page_idx, block_idx) {
                    if !text.trim().is_empty() {
                        translated.insert((page_idx, block_idx), text.to_string());
                    }
                }
            }
        }
    }

    let mut rows = Vec::new();
    for page in document
        .get("pages")
        .and_then(|value| value.as_array())
        .map(|a| a.as_slice())
        .unwrap_or_default()
    {
        let page_idx = value_as_i64(page.get("page_index")).unwrap_or(0);
        for (block_idx, block) in page
            .get("blocks")
            .and_then(|value| value.as_array())
            .map(|a| a.as_slice())
            .unwrap_or_default()
            .iter()
            .enumerate()
        {
            let block_id = block
                .get("block_id")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string();
            let source_text = searchable_block_text(block, asset_catalog);
            let translated_text = translated
                .get(&(page_idx, block_idx as i64))
                .cloned()
                .unwrap_or_default();
            if block_id.is_empty() || (source_text.trim().is_empty() && translated_text.is_empty())
            {
                continue;
            }
            rows.push(FtsBlockRow {
                page_idx,
                block_id,
                source_text,
                translated_text,
            });
        }
    }
    Ok(rows)
}

// ── 整本书的索引 ───────────────────────────────────────────────────────────

/// 参与整本索引的一个任务。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FtsCandidate {
    pub job_id: String,
    pub created_at: String,
    /// OCR 本地页 `L` = 文档第 `ocr_pages[L]` 页。
    pub ocr_pages: Vec<u32>,
    /// 这个任务翻译了的文档页。纯 OCR 任务为空。
    pub translated_pages: Vec<u32>,
}

/// 每个文档页由哪个候选提供索引（返回候选下标）。
///
/// 一本书可能翻译过好几次、每次只翻几页。索引原来只放最后成功的那个任务 —— 翻完 1-5 页
/// 再翻 6-10 页，前 5 页就搜不到了。规则：
///
/// - 优先**翻译了这页**的任务里最新的（译文和原文都能搜到）；
/// - 没有任何任务翻译过这页，就取 OCR 覆盖了它的任务里最新的（至少原文能搜到）。
///
/// 「最新」= `(提交时间, job_id)`，和阅读器的合并计划同一个方向。
pub fn fts_page_owners(candidates: &[FtsCandidate]) -> std::collections::BTreeMap<u32, usize> {
    let mut owners: std::collections::BTreeMap<u32, (bool, usize)> = std::collections::BTreeMap::new();
    let rank = |index: usize| (&candidates[index].created_at, &candidates[index].job_id);
    for (index, candidate) in candidates.iter().enumerate() {
        for &page in &candidate.ocr_pages {
            let translated = candidate.translated_pages.contains(&page);
            let better = match owners.get(&page) {
                None => true,
                Some(&(current_translated, current)) => {
                    (translated, rank(index)) > (current_translated, rank(current))
                }
            };
            if better {
                owners.insert(page, (translated, index));
            }
        }
    }
    owners.into_iter().map(|(page, (_, index))| (page, index)).collect()
}

/// 一个任务能不能给整本索引供稿：成功、且记录里的 OCR 文档还在盘上 —— 返回它的路径。
///
/// `build_document_fts` 按它挑候选；启动回填判断「索引是否过期」也按它挑（只做 `is_file`，
/// 不读内容）。两边必须同一条规则：产物已被删掉的任务重建时进不了索引，若判定还算它，
/// 那本书每次启动都会被判过期、重建一遍。
pub(super) fn fts_normalized_document(
    job: &crate::models::domain::JobSnapshot,
    data_root: &Path,
) -> Option<std::path::PathBuf> {
    use crate::models::domain::JobStatusKind;
    use crate::storage_paths::resolve_normalized_document;

    if job.status != JobStatusKind::Succeeded {
        return None;
    }
    resolve_normalized_document(job, data_root).filter(|path| path.is_file())
}

/// 整本书的索引行，按提供它们的任务分组：`(job_id, 行)`。
///
/// 行里的 `page_idx` 仍是那个任务自己的本地页号 —— 搜索结果跳转时打开的就是那个任务的那
/// 一页，锚点对得上。OCR 文档和译文目录从任务记录里取（`normalized_document_json`、
/// `translations_dir`），不按 `job_root/ocr` 猜：复用 OCR 的任务自己的 `ocr/` 是空的，
/// 原来这类书全文搜索什么都搜不到。
pub fn build_document_fts(
    jobs: &[crate::models::domain::JobSnapshot],
    data_root: &Path,
) -> Vec<(String, Vec<FtsBlockRow>)> {
    use crate::models::domain::WorkflowKind;
    use crate::storage_paths::resolve_data_path;

    struct Loaded {
        rows: Vec<FtsBlockRow>,
    }
    let mut candidates = Vec::new();
    let mut loaded = Vec::new();
    for job in jobs {
        let Some(normalized) = fts_normalized_document(job, data_root) else { continue };
        let Some(artifacts) = job.artifacts.as_ref() else { continue };
        let translated_dir = artifacts
            .translations_dir
            .as_deref()
            .and_then(|raw| resolve_data_path(data_root, raw).ok())
            .unwrap_or_else(|| data_root.join("jobs").join(&job.job_id).join("translated"));
        let Ok(rows) = build_fts_rows(&normalized, &translated_dir) else { continue };
        let max_local = rows.iter().map(|row| row.page_idx).max().unwrap_or(-1);
        // 老任务没记 ocr_page_numbers：那时 OCR 都是整本，本地页 = 文档页 - 1。
        let ocr_pages: Vec<u32> = if artifacts.ocr_page_numbers.is_empty() {
            (1..=(max_local + 1).max(0) as u32).collect()
        } else {
            artifacts.ocr_page_numbers.clone()
        };
        let translated_pages = if job.workflow == WorkflowKind::Ocr {
            Vec::new()
        } else {
            retain_core::document_pages::translated_document_pages(
                &ocr_pages,
                job.request_payload.translation.start_page,
                job.request_payload.translation.end_page,
            )
            .unwrap_or_default()
        };
        candidates.push(FtsCandidate {
            job_id: job.job_id.clone(),
            created_at: job.created_at.clone(),
            ocr_pages,
            translated_pages,
        });
        loaded.push(Loaded { rows });
    }
    let owners = fts_page_owners(&candidates);
    candidates
        .iter()
        .zip(loaded)
        .enumerate()
        .filter_map(|(index, (candidate, loaded))| {
            let rows: Vec<FtsBlockRow> = loaded
                .rows
                .into_iter()
                .filter(|row| {
                    usize::try_from(row.page_idx)
                        .ok()
                        .and_then(|local| candidate.ocr_pages.get(local))
                        .is_some_and(|page| owners.get(page) == Some(&index))
                })
                .collect();
            (!rows.is_empty()).then(|| (candidate.job_id.clone(), rows))
        })
        .collect()
}

fn searchable_block_text(
    block: &serde_json::Value,
    asset_catalog: Option<&serde_json::Map<String, serde_json::Value>>,
) -> String {
    let text = block
        .get("text")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if !text.is_empty() {
        return text.to_string();
    }
    let content = block.get("content").and_then(|value| value.as_object());
    for key in ["search_text", "caption", "summary"] {
        let value = content
            .and_then(|item| item.get(key))
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if !value.is_empty() {
            return value.to_string();
        }
    }
    let Some(asset_catalog) = asset_catalog else {
        return String::new();
    };
    let mut asset_ids = Vec::new();
    if let Some(asset_id) = content
        .and_then(|item| item.get("asset_id"))
        .and_then(|value| value.as_str())
    {
        push_unique_text(&mut asset_ids, asset_id);
    }
    if let Some(values) = content
        .and_then(|item| item.get("asset_ids"))
        .and_then(|value| value.as_array())
    {
        for value in values {
            if let Some(asset_id) = value.as_str() {
                push_unique_text(&mut asset_ids, asset_id);
            }
        }
    }
    let mut descriptions = Vec::new();
    for asset_id in asset_ids {
        let Some(asset) = asset_catalog.get(&asset_id) else {
            continue;
        };
        for key in ["caption", "summary", "alt", "title"] {
            if let Some(value) = asset.get(key).and_then(|value| value.as_str()) {
                push_unique_text(&mut descriptions, value);
            }
        }
    }
    descriptions.join(" ")
}

fn push_unique_text(values: &mut Vec<String>, value: &str) {
    let value = value.trim();
    if !value.is_empty() && !values.iter().any(|existing| existing == value) {
        values.push(value.to_string());
    }
}

fn value_as_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    let value = value?;
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    value.as_str()?.trim().parse::<i64>().ok()
}
