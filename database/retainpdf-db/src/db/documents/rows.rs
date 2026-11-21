use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::api::{BlockSearchHit, DocumentRecord};

/// 一本书从视图 `library_documents` 读（v36：文件 + 所属条目的书目信息，见迁移 `v36_library_items.sql`）。
/// 最后一列 `has_translation`：有没有成功的非 OCR 任务（走 idx_jobs_document_updated，每行一次
/// 索引探测）。规则和 `BEST_SUCCEEDED_JOB_SQL` 的「非 OCR 优先」同源，见 DocumentRecord 字段注释。
pub(in crate::db) const DOCUMENT_COLUMNS: &str = "d.document_id, d.title, d.title_source, d.title_locked, d.authors_json, d.year, d.doi, d.source_filename, d.page_count, d.bytes, d.active_job_id, d.reading_status, d.added_at, d.last_opened_at, d.updated_at, EXISTS (SELECT 1 FROM jobs j WHERE j.document_id = d.document_id AND j.status = 'succeeded' AND COALESCE(j.workflow, '') <> 'ocr')";

/// sha2 0.11 的输出类型不再实现 LowerHex,统一走手动十六进制编码。
pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(in crate::db) fn default_title_from_filename(filename: &str) -> String {
    filename
        .strip_suffix(".pdf")
        .or_else(|| filename.strip_suffix(".PDF"))
        .unwrap_or(filename)
        .trim()
        .to_string()
}

pub(in crate::db) fn query_document(
    conn: &Connection,
    document_id: &str,
) -> Result<Option<DocumentRecord>> {
    let record = conn
        .query_row(
            &format!("SELECT {DOCUMENT_COLUMNS} FROM library_documents d WHERE d.document_id = ?1"),
            params![document_id],
            row_to_document,
        )
        .optional()?;
    let Some(record) = record else {
        return Ok(None);
    };
    Ok(Some(record))
}


pub(in crate::db) fn row_to_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentRecord> {
    Ok(DocumentRecord {
        document_id: row.get(0)?,
        title: row.get(1)?,
        title_source: row.get(2)?,
        title_locked: row.get::<_, i64>(3)? != 0,
        authors_json: row.get(4)?,
        year: row.get(5)?,
        doi: row.get(6)?,
        source_filename: row.get(7)?,
        page_count: row.get::<_, i64>(8)? as u32,
        bytes: row.get::<_, i64>(9)? as u64,
        active_job_id: row.get(10)?,
        // AI 改写文档留下的字段，v36 删了那一列；契约里是可选的，不再出现。
        active_version_id: None,
        reading_status: row.get(11)?,
        added_at: row.get(12)?,
        last_opened_at: row.get(13)?,
        updated_at: row.get(14)?,
        source_pdf_url: String::new(),
        cover_url: String::new(),
        thumbnail_url: String::new(),
        has_translation: row.get::<_, i64>(15)? != 0,
    })
}

pub(super) fn row_to_search_hit(row: &rusqlite::Row<'_>) -> rusqlite::Result<BlockSearchHit> {
    Ok(BlockSearchHit {
        document_id: row.get(0)?,
        job_id: row.get(1)?,
        page_idx: row.get(2)?,
        block_id: row.get(3)?,
        source_snippet: row.get(4)?,
        translated_snippet: row.get(5)?,
    })
}

