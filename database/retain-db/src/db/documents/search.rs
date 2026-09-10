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

    /// 全文检索。trigram 分词要求查询 ≥3 字符,更短的查询回退 LIKE 扫描。
    /// `document_id` 非空时只搜该文档（阅读器 / AI 整本问答）。
    pub fn search_blocks(
        &self,
        query: &str,
        limit: u32,
        document_id: Option<&str>,
    ) -> Result<Vec<BlockSearchHit>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let doc_filter = document_id.map(str::trim).filter(|s| !s.is_empty());
        let conn = self.connect()?;
        let mut hits = Vec::new();
        if query.chars().count() >= 3 {
            let phrase = format!("\"{}\"", query.replace('"', " "));
            if let Some(doc_id) = doc_filter {
                let mut stmt = conn.prepare(
                    r#"
                    SELECT document_id, job_id, page_idx, block_id,
                           snippet(blocks_fts, 4, '[', ']', '…', 16),
                           snippet(blocks_fts, 5, '[', ']', '…', 16)
                    FROM blocks_fts
                    WHERE blocks_fts MATCH ?1 AND document_id = ?2
                    ORDER BY rank
                    LIMIT ?3
                    "#,
                )?;
                let rows =
                    stmt.query_map(params![phrase, doc_id, limit as i64], row_to_search_hit)?;
                for row in rows {
                    hits.push(row?);
                }
            } else {
                let mut stmt = conn.prepare(
                    r#"
                    SELECT document_id, job_id, page_idx, block_id,
                           snippet(blocks_fts, 4, '[', ']', '…', 16),
                           snippet(blocks_fts, 5, '[', ']', '…', 16)
                    FROM blocks_fts
                    WHERE blocks_fts MATCH ?1
                    ORDER BY rank
                    LIMIT ?2
                    "#,
                )?;
                let rows = stmt.query_map(params![phrase, limit as i64], row_to_search_hit)?;
                for row in rows {
                    hits.push(row?);
                }
            }
            return Ok(hits);
        }
        let pattern = format!("%{}%", query.replace('%', "").replace('_', ""));
        if let Some(doc_id) = doc_filter {
            let mut stmt = conn.prepare(
                r#"
                SELECT document_id, job_id, page_idx, block_id,
                       substr(source_text, 1, 120), substr(translated_text, 1, 120)
                FROM blocks_fts
                WHERE (source_text LIKE ?1 OR translated_text LIKE ?1)
                  AND document_id = ?2
                LIMIT ?3
                "#,
            )?;
            let rows = stmt.query_map(params![pattern, doc_id, limit as i64], row_to_search_hit)?;
            for row in rows {
                hits.push(row?);
            }
        } else {
            let mut stmt = conn.prepare(
                r#"
                SELECT document_id, job_id, page_idx, block_id,
                       substr(source_text, 1, 120), substr(translated_text, 1, 120)
                FROM blocks_fts
                WHERE source_text LIKE ?1 OR translated_text LIKE ?1
                LIMIT ?2
                "#,
            )?;
            let rows = stmt.query_map(params![pattern, limit as i64], row_to_search_hit)?;
            for row in rows {
                hits.push(row?);
            }
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
    let normalized_path = job_root
        .join("ocr")
        .join("normalized")
        .join("document.v1.json");
    let raw = std::fs::read_to_string(&normalized_path)
        .with_context(|| format!("read {}", normalized_path.display()))?;
    let document: serde_json::Value = serde_json::from_str(&raw)?;
    let asset_catalog = document.get("assets").and_then(|value| value.as_object());

    let mut translated: std::collections::HashMap<(i64, i64), String> =
        std::collections::HashMap::new();
    let translated_dir = job_root.join("translated");
    if let Ok(entries) = std::fs::read_dir(&translated_dir) {
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
