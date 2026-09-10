use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, ToSql};

use crate::models::api::DocumentRecord;
use crate::models::domain::{now_iso, UploadRecord};
use crate::storage_paths::resolve_data_path;

use super::rows::{
    default_title_from_filename, load_document_tags, query_document, row_to_document,
    DOCUMENT_COLUMNS,
};
use crate::db::Db;

struct DocumentFilterQuery {
    where_sql: String,
    args: Vec<String>,
}

fn build_document_filter_query(
    reading_status: Option<&str>,
    tag: Option<&str>,
    collection_id: Option<&str>,
) -> DocumentFilterQuery {
    // A document without a backing upload is not a readable library item and
    // must be excluded from both the page and its authoritative total.
    let mut clauses = vec![
        "EXISTS (SELECT 1 FROM uploads u WHERE u.content_hash = d.document_id AND u.content_hash <> '')"
            .to_string(),
    ];
    let mut args = Vec::new();
    if let Some(status) = reading_status {
        clauses.push(format!("d.reading_status = ?{}", args.len() + 1));
        args.push(status.to_string());
    }
    if let Some(tag) = tag {
        clauses.push(format!(
            "EXISTS (SELECT 1 FROM document_tags t WHERE t.document_id = d.document_id AND t.tag = ?{})",
            args.len() + 1
        ));
        args.push(tag.to_string());
    }
    if let Some(collection_id) = collection_id {
        clauses.push(format!(
            "EXISTS (SELECT 1 FROM collection_documents c WHERE c.document_id = d.document_id AND c.collection_id = ?{})",
            args.len() + 1
        ));
        args.push(collection_id.to_string());
    }
    DocumentFilterQuery {
        where_sql: format!("WHERE {}", clauses.join(" AND ")),
        args,
    }
}

fn query_documents(
    conn: &Connection,
    filter: &DocumentFilterQuery,
    limit: u32,
    offset: u32,
) -> Result<Vec<DocumentRecord>> {
    let sql = format!(
        "SELECT {DOCUMENT_COLUMNS} FROM documents d {} ORDER BY d.added_at DESC LIMIT ?{} OFFSET ?{}",
        filter.where_sql,
        filter.args.len() + 1,
        filter.args.len() + 2
    );
    let limit = limit as i64;
    let offset = offset as i64;
    let mut args: Vec<&dyn ToSql> = filter
        .args
        .iter()
        .map(|value| value as &dyn ToSql)
        .collect();
    args.push(&limit);
    args.push(&offset);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(args), row_to_document)?;
    let mut documents = Vec::new();
    for row in rows {
        documents.push(row?);
    }
    for document in &mut documents {
        document.tags = load_document_tags(conn, &document.document_id)?;
    }
    Ok(documents)
}

fn count_documents_with_filter(conn: &Connection, filter: &DocumentFilterQuery) -> Result<u64> {
    let sql = format!("SELECT COUNT(*) FROM documents d {}", filter.where_sql);
    let count: i64 = conn.query_row(
        &sql,
        rusqlite::params_from_iter(filter.args.iter()),
        |row| row.get(0),
    )?;
    u64::try_from(count).context("document count cannot be negative")
}

impl Db {
    /// 上传即建档:同一内容哈希只有一个 document,重复上传仅刷新时间与文件名。
    pub fn upsert_document_from_upload(&self, upload: &UploadRecord) -> Result<()> {
        if upload.content_hash.is_empty() {
            return Ok(());
        }
        let conn = self.connect()?;
        Self::upsert_document_from_upload_on(&conn, upload)
    }

    pub(in crate::db) fn upsert_document_from_upload_on(
        conn: &Connection,
        upload: &UploadRecord,
    ) -> Result<()> {
        if upload.content_hash.is_empty() {
            return Ok(());
        }
        let now = now_iso();
        conn.execute(
            r#"
            INSERT INTO documents (
                document_id, title, source_filename, page_count, bytes, added_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
            ON CONFLICT(document_id) DO UPDATE SET
                source_filename=excluded.source_filename,
                page_count=excluded.page_count,
                bytes=excluded.bytes,
                updated_at=excluded.updated_at
            "#,
            params![
                upload.content_hash,
                default_title_from_filename(&upload.filename),
                upload.filename,
                upload.page_count as i64,
                upload.bytes as i64,
                now,
            ],
        )?;
        Ok(())
    }

    pub fn get_document(&self, document_id: &str) -> Result<DocumentRecord> {
        let conn = self.connect()?;
        let record = query_document(&conn, document_id)?
            .with_context(|| format!("document not found: {document_id}"))?;
        Ok(record)
    }

    /// 任意 job_id(含历史 run 与 -ocr 子任务)→ 所属 document。
    /// 前端打开历史 job 时不能再靠 active_job_id 反查——那只匹配当前
    /// 生效 run,历史 run 会静默失配(收藏不入库、问答退化全库)。
    pub fn get_document_by_job_id(&self, job_id: &str) -> Result<Option<DocumentRecord>> {
        let conn = self.connect()?;
        let document_id: Option<String> = conn
            .query_row(
                r#"
                SELECT COALESCE(
                    NULLIF(j.document_id, ''),
                    (SELECT NULLIF(u.content_hash, '') FROM uploads u WHERE u.upload_id = j.upload_id)
                )
                FROM jobs j WHERE j.job_id = ?1
                "#,
                params![job_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        let Some(document_id) = document_id else {
            return Ok(None);
        };
        query_document(&conn, &document_id)
    }

    pub fn list_documents(
        &self,
        limit: u32,
        offset: u32,
        reading_status: Option<&str>,
        tag: Option<&str>,
        collection_id: Option<&str>,
    ) -> Result<Vec<DocumentRecord>> {
        let conn = self.connect()?;
        let filter = build_document_filter_query(reading_status, tag, collection_id);
        query_documents(&conn, &filter, limit, offset)
    }

    pub fn count_documents(
        &self,
        reading_status: Option<&str>,
        tag: Option<&str>,
        collection_id: Option<&str>,
    ) -> Result<u64> {
        let conn = self.connect()?;
        let filter = build_document_filter_query(reading_status, tag, collection_id);
        count_documents_with_filter(&conn, &filter)
    }

    /// Reads the page and its filtered total from one SQLite snapshot so a
    /// concurrent upload or deletion cannot make the response self-contradictory.
    pub fn list_documents_with_total(
        &self,
        limit: u32,
        offset: u32,
        reading_status: Option<&str>,
        tag: Option<&str>,
        collection_id: Option<&str>,
    ) -> Result<(Vec<DocumentRecord>, u64)> {
        let mut conn = self.connect()?;
        let transaction = conn.transaction()?;
        let filter = build_document_filter_query(reading_status, tag, collection_id);
        let total = count_documents_with_filter(&transaction, &filter)?;
        let documents = query_documents(&transaction, &filter, limit, offset)?;
        transaction.commit()?;
        Ok((documents, total))
    }

    pub fn update_document_fields(
        &self,
        document_id: &str,
        title: Option<&str>,
        reading_status: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<DocumentRecord> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let now = now_iso();
        if let Some(title) = title {
            tx.execute(
                "UPDATE documents SET title = ?1, updated_at = ?2 WHERE document_id = ?3",
                params![title, now, document_id],
            )?;
            tx.execute(
                r#"
                INSERT INTO document_title_state (document_id, source, locked, suggestion_id, updated_at)
                VALUES (?1, 'user', 1, NULL, ?2)
                ON CONFLICT(document_id) DO UPDATE SET
                    source = 'user',
                    locked = 1,
                    suggestion_id = NULL,
                    updated_at = excluded.updated_at
                "#,
                params![document_id, now],
            )?;
        }
        if let Some(status) = reading_status {
            tx.execute(
                "UPDATE documents SET reading_status = ?1, updated_at = ?2 WHERE document_id = ?3",
                params![status, now, document_id],
            )?;
        }
        if let Some(tags) = tags {
            tx.execute(
                "DELETE FROM document_tags WHERE document_id = ?1",
                params![document_id],
            )?;
            for tag in tags {
                let tag = tag.trim();
                if tag.is_empty() {
                    continue;
                }
                tx.execute(
                    "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                    params![document_id, tag],
                )?;
            }
        }
        let record = query_document(&tx, document_id)?
            .with_context(|| format!("document not found: {document_id}"))?;
        tx.commit()?;
        Ok(record)
    }

    /// 把 job 归属到 document(经 upload.content_hash),返回 document_id。
    pub fn link_job_to_document(&self, job_id: &str, upload_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        let document_id: Option<String> = conn
            .query_row(
                "SELECT content_hash FROM uploads WHERE upload_id = ?1 AND content_hash <> ''",
                params![upload_id],
                |row| row.get(0),
            )
            .optional()?;
        let Some(document_id) = document_id else {
            return Ok(None);
        };
        conn.execute(
            "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
            params![document_id, job_id],
        )?;
        Ok(Some(document_id))
    }

    /// 按 document_id(= content_hash) 找到最近一次上传记录，用于源 PDF / 封面 / 重译。
    pub fn find_upload_for_document(&self, document_id: &str) -> Result<Option<UploadRecord>> {
        let conn = self.connect()?;
        let upload = conn
            .query_row(
                r#"
                SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at,
                       developer_mode, content_hash
                FROM uploads
                WHERE content_hash = ?1 AND content_hash <> ''
                ORDER BY
                    CASE WHEN upload_id = 'version-upload-' || COALESCE(
                        (SELECT active_version_id FROM documents WHERE document_id = ?1),
                        ''
                    ) THEN 0 ELSE 1 END,
                    uploaded_at DESC
                LIMIT 1
                "#,
                params![document_id],
                |row| {
                    Ok(UploadRecord {
                        upload_id: row.get(0)?,
                        filename: row.get(1)?,
                        stored_path: row.get(2)?,
                        bytes: row.get::<_, i64>(3)? as u64,
                        page_count: row.get::<_, i64>(4)? as u32,
                        uploaded_at: row.get(5)?,
                        developer_mode: row.get::<_, i64>(6)? != 0,
                        content_hash: row.get(7)?,
                    })
                },
            )
            .optional()?;
        let Some(upload) = upload else {
            return Ok(None);
        };
        Ok(Some(UploadRecord {
            stored_path: resolve_data_path(&self.data_root, &upload.stored_path)?
                .to_string_lossy()
                .to_string(),
            ..upload
        }))
    }

    /// 该文档名下的所有 job_id(经 jobs.document_id 关联)。
    pub fn job_ids_for_document(&self, document_id: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt =
            conn.prepare("SELECT job_id FROM jobs WHERE document_id = ?1 ORDER BY created_at")?;
        let rows = stmt.query_map(params![document_id], |row| row.get::<_, String>(0))?;
        let mut ids = Vec::new();
        for row in rows {
            ids.push(row?);
        }
        Ok(ids)
    }

    /// 该文档对应的所有 upload 记录(可能同一文件多次上传成多个 upload_id),
    /// stored_path 解析为绝对路径供删除磁盘文件。
    pub fn uploads_for_document(&self, document_id: &str) -> Result<Vec<UploadRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at,
                   developer_mode, content_hash
            FROM uploads
            WHERE content_hash = ?1 AND content_hash <> ''
            "#,
        )?;
        let rows = stmt.query_map(params![document_id], |row| {
            Ok(UploadRecord {
                upload_id: row.get(0)?,
                filename: row.get(1)?,
                stored_path: row.get(2)?,
                bytes: row.get::<_, i64>(3)? as u64,
                page_count: row.get::<_, i64>(4)? as u32,
                uploaded_at: row.get(5)?,
                developer_mode: row.get::<_, i64>(6)? != 0,
                content_hash: row.get(7)?,
            })
        })?;
        let mut uploads = Vec::new();
        for row in rows {
            let upload = row?;
            let resolved = resolve_data_path(&self.data_root, &upload.stored_path)?
                .to_string_lossy()
                .to_string();
            uploads.push(UploadRecord {
                stored_path: resolved,
                ..upload
            });
        }
        Ok(uploads)
    }

    pub fn delete_upload(&self, upload_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM uploads WHERE upload_id = ?1",
            params![upload_id],
        )?;
        Ok(changed > 0)
    }

    /// 删除文档行(FK 级联清 favorites/document_tags/collection_documents,
    /// ai_conversations.document_id 置 NULL)+ 派生的 blocks_fts 行。
    pub fn delete_document(&self, document_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM blocks_fts WHERE document_id = ?1",
            params![document_id],
        )?;
        let changed = conn.execute(
            "DELETE FROM documents WHERE document_id = ?1",
            params![document_id],
        )?;
        Ok(changed > 0)
    }

    /// 修复悬空的 active_job_id:若它指向的 job 已不存在,优先重指该文档下
    /// 最新的非 OCR 成功任务；只有 OCR 成功任务时回退到 OCR。完全没有则
    /// 置 NULL(降级为干净馆藏)。删 job 后必调,防僵尸卡。
    pub fn reconcile_document_active_job(&self, document_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            UPDATE documents SET active_job_id = (
                SELECT j.job_id FROM jobs j
                WHERE j.document_id = documents.document_id
                  AND j.status_json = '"succeeded"'
                ORDER BY CASE WHEN j.workflow = '"ocr"' THEN 1 ELSE 0 END, j.finished_at DESC
                LIMIT 1
            ), updated_at = ?2
            WHERE documents.document_id = ?1
              AND documents.active_job_id IS NOT NULL
              AND documents.active_job_id NOT IN (SELECT job_id FROM jobs)
            "#,
            params![document_id, now_iso()],
        )?;
        Ok(())
    }

    pub fn set_document_active_job(
        &self,
        document_id: &str,
        job_id: &str,
        page_count: Option<u32>,
    ) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE documents SET active_job_id = ?1, updated_at = ?2 WHERE document_id = ?3",
            params![job_id, now_iso(), document_id],
        )?;
        if let Some(page_count) = page_count {
            conn.execute(
                "UPDATE documents SET page_count = ?1 WHERE document_id = ?2 AND ?1 > 0",
                params![page_count as i64, document_id],
            )?;
        }
        Ok(())
    }
}
