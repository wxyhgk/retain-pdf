use anyhow::Result;
use rusqlite::params;

use crate::storage_paths::resolve_data_path;

use super::crud::{delete_document_item, repair_wrong_document_cards};
use super::search::fts_normalized_document;
use super::sha256_hex;
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
            SELECT f.file_id FROM item_files f
            WHERE NOT EXISTS (
                SELECT 1 FROM uploads u
                WHERE u.content_hash = f.file_id AND u.content_hash <> ''
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
        delete_document_item(&conn, document_id)?;
    }
    tracing::info!(
        "[library] cleaned {} orphan document(s) with no backing upload",
        orphan_ids.len()
    );
    Ok(())
}

/// 启动时补全文索引:没有索引行的书,以及**索引过期**的书 —— 有成功的非 OCR 任务比
/// 索引里最新的那个任务更新,**且它的产物还在**(重建真的会用到它)。
///
/// 任务结束时 lifecycle 会重建索引,但老代码对没有 upload_id 的任务(重新渲染 / 重试 /
/// 重跑)直接跳过,索引停在更早的任务上;原来这里只补「完全没索引」的书,过期的永不自愈。
/// 判断先用一次 blocks_fts 扫描 + jobs 上的比较选出候选任务,稳态启动候选为空、不碰文件;
/// 有候选时只对它们做一次 `is_file`(规则与重建共用 `fts_normalized_document`,不读内容)。
/// 产物已被删掉的更新任务重建时进不了索引 —— 不过滤它,那本书每次启动都会被判过期、
/// 重建一遍。纯 OCR 任务不参与判定:它可能一页都不拥有(翻译优先),参与会让那本书
/// 每次启动都重建。
fn backfill_fts_indexes(db: &Db) -> Result<()> {
    for document_id in fts_backfill_targets(db)? {
        // 按这本书所有成功任务建索引，不只是 active_job：范围翻译之后前面翻过的页也要搜得到；
        // 复用 OCR 的书原来按 job_root/ocr 找不到 OCR 文档、一行都建不出来，每次启动都重试。
        if let Err(error) = db.rebuild_document_fts(&document_id) {
            tracing::warn!("[library] fts backfill failed for {document_id}: {error}");
        }
    }
    Ok(())
}

/// 启动回填要重建索引的书(规则见 `backfill_fts_indexes`)。没有任何成功任务的书(只有失败 / 在跑任务的
/// 失败卡、在跑卡)没有可建的内容,不算目标 —— 否则它们每次启动都被判成「没有索引」。
pub(super) fn fts_backfill_targets(db: &Db) -> Result<Vec<String>> {
    let conn = db.connect()?;
    // (document_id, 比索引新的成功任务 —— 没有索引行的书为 NULL)
    let rows: Vec<(String, Option<String>)> = {
        let mut stmt = conn.prepare(
            r#"
            WITH indexed AS (
                SELECT f.document_id, COALESCE(MAX(j.created_at), '') AS newest
                FROM (SELECT DISTINCT document_id, job_id FROM blocks_fts) f
                LEFT JOIN jobs j ON j.job_id = f.job_id
                GROUP BY f.document_id
            )
            SELECT d.document_id, NULL FROM library_documents d
            LEFT JOIN indexed i ON i.document_id = d.document_id
            WHERE d.active_job_id IS NOT NULL AND i.document_id IS NULL
              AND EXISTS (
                  SELECT 1 FROM jobs s
                  WHERE s.document_id = d.document_id AND s.status = 'succeeded'
              )
            UNION ALL
            SELECT d.document_id, j.job_id FROM library_documents d
            JOIN indexed i ON i.document_id = d.document_id
            JOIN jobs j ON j.document_id = d.document_id
            WHERE d.active_job_id IS NOT NULL
              AND j.status = 'succeeded'
              AND j.workflow <> 'ocr'
              AND j.created_at > i.newest
            "#,
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    drop(conn);
    let mut targets: Vec<String> = Vec::new();
    for (document_id, newer_job_id) in rows {
        if targets.contains(&document_id) {
            continue;
        }
        let usable = match newer_job_id {
            None => true,
            Some(job_id) => db
                .get_job(&job_id)
                .ok()
                .and_then(|job| fts_normalized_document(&job, &db.data_root))
                .is_some(),
        };
        if usable {
            targets.push(document_id);
        }
    }
    Ok(targets)
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
                tracing::warn!("[library] backfill skip upload {upload_id}: bad path: {error}");
                continue;
            }
        };
        let bytes = match std::fs::read(&resolved) {
            Ok(bytes) => bytes,
            Err(error) => {
                tracing::warn!(
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

/// 启动只修「明显错」的书卡(指针为空 / 指向已删或别的书的任务 / 纯 OCR 卡而书里已有翻译成功),
/// 规则和运行时是同一份 SQL(`repair_wrong_document_cards`)。以前这里无条件把每本书的卡改成
/// 最好的成功任务、没有就清成 NULL,和运行时相反:重启后失败卡、在跑任务的卡都消失,失败卡还不会自愈。
pub(super) fn backfill_active_jobs(db: &Db) -> Result<()> {
    let conn = db.connect()?;
    repair_wrong_document_cards(&conn, None)?;
    Ok(())
}
