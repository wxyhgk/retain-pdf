use anyhow::Result;
use rusqlite::params;

use crate::storage_paths::resolve_data_path;

use super::{build_fts_rows_from_job_dir, sha256_hex};
use crate::db::Db;

pub(super) fn run(db: &Db) -> Result<()> {
    backfill_upload_hashes(db)?;
    backfill_job_document_links(db)?;
    backfill_active_jobs(db)?;
    backfill_fts_indexes(db)?;
    cleanup_orphan_documents(db)?;
    Ok(())
}

/// 一次性清理孤儿文档:没有任何 upload 支撑(源文件早被 retention GC 掉)
/// 的文档行,是永远打不开的僵尸卡。只清没有收藏引用的——有收藏的降级
/// 数据保留给用户经 DELETE /documents/:id 显式处理,不无声销毁策展内容。
/// root-cause(retention 不再删 document-backed upload)已堵住新孤儿产生,
/// 此清理只处理历史遗留。
fn cleanup_orphan_documents(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    let orphan_ids: Vec<String> = {
        let mut stmt = conn.prepare(
            r#"
            SELECT d.document_id FROM documents d
            WHERE NOT EXISTS (
                SELECT 1 FROM uploads u
                WHERE u.content_hash = d.document_id AND u.content_hash <> ''
            )
            AND NOT EXISTS (
                SELECT 1 FROM favorites f WHERE f.document_id = d.document_id
            )
            "#,
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    if orphan_ids.is_empty() {
        return Ok(());
    }
    for document_id in &orphan_ids {
        conn.execute(
            "DELETE FROM blocks_fts WHERE document_id = ?1",
            params![document_id],
        )?;
        conn.execute(
            "DELETE FROM documents WHERE document_id = ?1",
            params![document_id],
        )?;
    }
    eprintln!(
        "[library] cleaned {} orphan document(s) with no backing upload",
        orphan_ids.len()
    );
    Ok(())
}

fn backfill_fts_indexes(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    let pending: Vec<(String, String)> = {
        let mut stmt = conn.prepare(
            r#"
            SELECT d.document_id, d.active_job_id FROM documents d
            WHERE d.active_job_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM blocks_fts f WHERE f.document_id = d.document_id)
            "#,
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    drop(conn);
    for (document_id, job_id) in pending {
        let job_root = db.data_root.join("jobs").join(&job_id);
        match build_fts_rows_from_job_dir(&job_root) {
            Ok(rows) => {
                if let Err(error) = db.replace_document_fts(&document_id, &job_id, &rows) {
                    eprintln!("[library] fts backfill failed for {document_id}: {error}");
                }
            }
            Err(error) => {
                eprintln!(
                    "[library] fts backfill skip {document_id}: {}: {error}",
                    job_root.display()
                );
            }
        }
    }
    Ok(())
}

fn backfill_upload_hashes(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    let pending: Vec<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT upload_id, stored_path FROM uploads WHERE content_hash = '' OR content_hash IS NULL",
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    for (upload_id, stored_path) in pending {
        let resolved = match resolve_data_path(&db.data_root, &stored_path) {
            Ok(path) => path,
            Err(error) => {
                eprintln!("[library] backfill skip upload {upload_id}: bad path: {error}");
                continue;
            }
        };
        let bytes = match std::fs::read(&resolved) {
            Ok(bytes) => bytes,
            Err(error) => {
                eprintln!(
                    "[library] backfill skip upload {upload_id}: unreadable {}: {error}",
                    resolved.display()
                );
                continue;
            }
        };
        let hash = sha256_hex(&bytes);
        conn.execute(
            "UPDATE uploads SET content_hash = ?1 WHERE upload_id = ?2",
            params![hash, upload_id],
        )?;
        let upload = db.get_upload(&upload_id)?;
        db.upsert_document_from_upload(&upload)?;
    }
    Ok(())
}

fn backfill_job_document_links(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    conn.execute(
        r#"
        UPDATE jobs SET document_id = (
            SELECT u.content_hash FROM uploads u
            WHERE u.upload_id = jobs.upload_id AND u.content_hash <> ''
        )
        WHERE jobs.document_id IS NULL AND jobs.upload_id IS NOT NULL
        "#,
        [],
    )?;
    // A translate-only job can reuse an earlier OCR artifact even when an older
    // producer persisted neither upload_id nor document_id on the new job. The
    // artifact job is still an authoritative document identity boundary.
    conn.execute(
        r#"
        UPDATE jobs AS target SET document_id = (
            SELECT source.document_id FROM jobs AS source
            WHERE source.job_id = json_extract(target.request_json, '$.source.artifact_job_id')
              AND source.document_id IS NOT NULL
              AND source.document_id <> ''
        )
        WHERE target.document_id IS NULL
          AND COALESCE(json_extract(target.request_json, '$.source.artifact_job_id'), '') <> ''
          AND EXISTS (
              SELECT 1 FROM jobs AS source
              WHERE source.job_id = json_extract(target.request_json, '$.source.artifact_job_id')
                AND source.document_id IS NOT NULL
                AND source.document_id <> ''
          )
        "#,
        [],
    )?;
    Ok(())
}

pub(super) fn backfill_active_jobs(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    conn.execute(
        r#"
        UPDATE documents SET active_job_id = (
            SELECT j.job_id FROM jobs j
            WHERE j.document_id = documents.document_id
              AND j.status_json = '"succeeded"'
            ORDER BY CASE WHEN j.workflow = '"ocr"' THEN 1 ELSE 0 END, j.finished_at DESC
            LIMIT 1
        )
        WHERE documents.active_job_id IS NOT (
            SELECT j.job_id FROM jobs j
            WHERE j.document_id = documents.document_id
              AND j.status_json = '"succeeded"'
            ORDER BY CASE WHEN j.workflow = '"ocr"' THEN 1 ELSE 0 END, j.finished_at DESC
            LIMIT 1
        )
        "#,
        [],
    )?;
    Ok(())
}
