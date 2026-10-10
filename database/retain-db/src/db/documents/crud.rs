
use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, ToSql, TransactionBehavior};

use crate::models::api::DocumentRecord;
use crate::models::domain::{now_iso, UploadRecord};
use crate::storage_paths::resolve_data_path;

use super::rows::{default_title_from_filename, query_document, row_to_document, DOCUMENT_COLUMNS};
use crate::db::Db;

/// 「这本书该展示哪个成功任务」的统一规则(相关子查询,外层必须是 `documents`):
/// 非 OCR 优先,同类取最近完成的。悬空修复、失败回退、启动回填共用这一条。
pub(super) const BEST_SUCCEEDED_JOB_SQL: &str = r#"
    SELECT j.job_id FROM jobs j
    WHERE j.document_id = documents.document_id
      AND j.status_json = '"succeeded"'
    ORDER BY CASE WHEN j.workflow = '"ocr"' THEN 1 ELSE 0 END, j.finished_at DESC
    LIMIT 1
"#;

struct DocumentFilterQuery {
    where_sql: String,
    args: Vec<String>,
}

/// 把用户输入变成 LIKE 模式：转义 SQLite LIKE 的三个元字符，再两侧加 %。
/// 转义符用 `\`，调用处必须配套写 `ESCAPE '\'`，否则标题里的 `%` 或 `_`
/// 会被当通配符——搜 "50%_summary" 会命中一堆无关文档。
fn like_pattern(query: &str) -> String {
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

fn build_document_filter_query(
    reading_status: Option<&str>,
    collection_id: Option<&str>,
    query: Option<&str>,
    owner: Option<&str>,
) -> DocumentFilterQuery {
    // A document without a backing upload is not a readable library item and
    // must be excluded from both the page and its authoritative total.
    let mut clauses = vec![
        "EXISTS (SELECT 1 FROM uploads u WHERE u.content_hash = d.document_id AND u.content_hash <> '')"
            .to_string(),
    ];
    let mut args = Vec::new();
    if let Some(owner) = owner {
        clauses.push(format!("d.owner_user_id = ?{}", args.len() + 1));
        args.push(owner.to_string());
    }
    if let Some(status) = reading_status {
        clauses.push(format!("d.reading_status = ?{}", args.len() + 1));
        args.push(status.to_string());
    }
    if let Some(collection_id) = collection_id {
        clauses.push(format!(
            "EXISTS (SELECT 1 FROM collection_documents c WHERE c.document_id = d.document_id AND c.collection_id = ?{})",
            args.len() + 1
        ));
        args.push(collection_id.to_string());
    }
    // 文档级文本搜索：标题或原始文件名任一命中即可。
    //
    // 此前 /documents 没有任何文本过滤，前端只能拉前 200 篇做客户端过滤并把
    // hasMore 钉成 false——超过 200 篇的库里，搜索会静默漏掉后面的匹配项。
    //
    // 用 LIKE 而非 FTS：这两列都短（标题 + 文件名），库规模是「个人文献库」量级，
    // 且 LIKE 能和现有的 reading_status / tag / collection 过滤在同一条 WHERE
    // 里自然组合。真需要正文全文检索时走已有的 /api/v1/search（块级）。
    if let Some(query) = query {
        let trimmed = query.trim();
        if !trimmed.is_empty() {
            clauses.push(format!(
                "(d.title LIKE ?{0} ESCAPE '\\' OR d.source_filename LIKE ?{0} ESCAPE '\\')",
                args.len() + 1
            ));
            args.push(like_pattern(trimmed));
        }
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

    /// 一批文档的当前标题（`document_id` → `title`），查不到的不出现在结果里。
    ///
    /// 任务列表、书架卡片按任务展示时，书名要和书籍详情一致 —— 书籍详情显示的是文档标题，
    /// 而它会被元数据建议自动改名或被用户手改；任务自己只知道上传时的文件名。
    pub fn document_titles(
        &self,
        document_ids: &[String],
    ) -> Result<std::collections::HashMap<String, String>> {
        let mut titles = std::collections::HashMap::new();
        if document_ids.is_empty() {
            return Ok(titles);
        }
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT title FROM documents WHERE document_id = ?1")?;
        for document_id in document_ids {
            if titles.contains_key(document_id) {
                continue;
            }
            let title: Option<String> = stmt
                .query_row(params![document_id], |row| row.get(0))
                .optional()?;
            if let Some(title) = title.map(|title| title.trim().to_string()).filter(|title| !title.is_empty()) {
                titles.insert(document_id.clone(), title);
            }
        }
        Ok(titles)
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
            collection_id: Option<&str>,
        query: Option<&str>,
    ) -> Result<Vec<DocumentRecord>> {
        let conn = self.connect()?;
        let filter = build_document_filter_query(reading_status, collection_id, query, None);
        query_documents(&conn, &filter, limit, offset)
    }

    pub fn count_documents(
        &self,
        reading_status: Option<&str>,
            collection_id: Option<&str>,
        query: Option<&str>,
    ) -> Result<u64> {
        let conn = self.connect()?;
        let filter = build_document_filter_query(reading_status, collection_id, query, None);
        count_documents_with_filter(&conn, &filter)
    }

    /// Reads the page and its filtered total from one SQLite snapshot so a
    /// concurrent upload or deletion cannot make the response self-contradictory.
    pub fn list_documents_with_total(
        &self,
        limit: u32,
        offset: u32,
        reading_status: Option<&str>,
        collection_id: Option<&str>,
        query: Option<&str>,
        owner: Option<&str>,
    ) -> Result<(Vec<DocumentRecord>, u64)> {
        let mut conn = self.connect()?;
        let transaction = conn.transaction()?;
        let filter = build_document_filter_query(reading_status, collection_id, query, owner);
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

    /// 直接给 job 写归属的 document。
    ///
    /// `link_job_to_document` 靠 job 的 upload_id 反查；从已有任务派生出来的任务（重新渲染
    /// 只带 artifact_job_id，不带 upload_id）走不通，归属只能从源任务继承。没写归属的 job
    /// 不在 `list_jobs_for_document` 里，阅读页就永远打不开它。
    pub fn set_job_document_id(&self, job_id: &str, document_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
            params![document_id, job_id],
        )?;
        Ok(())
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

    /// 删除文档行(FK 级联清 favorites/collection_documents,
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

    /// 在一个事务里删掉一批 job 行(连同它们的 events)。
    ///
    /// 与 [`Db::delete_document_cascade`] 同一个理由:馆藏删除一次要删
    /// "book job + 它的 -ocr 子 job"两行,逐个自动提交时中途失败会留下
    /// 子 job 还在而父 job 已没的孤儿。调用方同样必须在本方法成功之后
    /// 才动磁盘文件。
    pub fn delete_jobs(&self, job_ids: &[String]) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        delete_job_rows(&tx, job_ids)?;
        tx.commit()?;
        Ok(())
    }

    /// 在**一个事务**里删掉文档行及其名下所有 job / upload 行。
    ///
    /// 服务层的彻底删除原先是一串各自开连接、各自自动提交的 `delete_job` /
    /// `delete_upload` / `delete_document`。中途任何一步失败都留下没有自动
    /// 修复路径的半删状态:job 行删完了而文档行还在(书架上一本点不开的书),
    /// 或者反过来文档没了而 job 成孤儿。连 `delete_job` 与 `delete_document`
    /// 自身内部的两条 DELETE 也是分开提交的——events 删掉而 jobs 没删、
    /// blocks_fts 删掉而 documents 没删,都是能真实落地的中间态。
    ///
    /// 收进一条 IMMEDIATE 事务后,DB 侧只剩"全删"和"全不删"两个结果。
    ///
    /// 磁盘文件删不进事务,所以调用方必须把文件删除放到本方法**成功之后**:
    /// 那样最坏是留下一批孤儿文件(可回收、可重删),而不是丢掉指向它们的索引。
    pub fn delete_document_cascade(
        &self,
        document_id: &str,
        job_ids: &[String],
        upload_ids: &[String],
    ) -> Result<bool> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        delete_job_rows(&tx, job_ids)?;
        for upload_id in upload_ids {
            tx.execute(
                "DELETE FROM uploads WHERE upload_id = ?1",
                params![upload_id],
            )?;
        }
        tx.execute(
            "DELETE FROM blocks_fts WHERE document_id = ?1",
            params![document_id],
        )?;
        let changed = tx.execute(
            "DELETE FROM documents WHERE document_id = ?1",
            params![document_id],
        )?;
        tx.commit()?;
        Ok(changed > 0)
    }

    /// 修复悬空的 active_job_id:若它指向的 job 已不存在,优先重指该文档下
    /// 最新的非 OCR 成功任务；只有 OCR 成功任务时回退到 OCR。完全没有则
    /// 置 NULL(降级为干净馆藏)。删 job 后必调,防僵尸卡。
    pub fn reconcile_document_active_job(&self, document_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            &format!(
                r#"
                UPDATE documents SET active_job_id = ({BEST_SUCCEEDED_JOB_SQL}), updated_at = ?2
                WHERE documents.document_id = ?1
                  AND documents.active_job_id IS NOT NULL
                  AND documents.active_job_id NOT IN (SELECT job_id FROM jobs)
                "#
            ),
            params![document_id, now_iso()],
        )?;
        Ok(())
    }

    /// 书卡还指着一个**没成功**结束的任务(失败 / 取消)时,按同一条规则
    /// (`BEST_SUCCEEDED_JOB_SQL`)退回这本书最好的成功任务。
    ///
    /// 重试 / 重跑 / 重新渲染提交时就把指针给了新任务(要立刻看到进度);新任务失败了,
    /// 指针原来就停在失败任务上,书卡显示失败,而这本书明明有成功的译文。
    /// 指针已经被别的任务接走(用户又提交了一个)就不动;这本书一个成功任务都没有时也不动
    /// —— 那时展示失败任务(能看到错误、能重试)比空卡有用。返回是否改了。
    pub fn release_document_active_job(&self, document_id: &str, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            &format!(
                r#"
                UPDATE documents SET active_job_id = ({BEST_SUCCEEDED_JOB_SQL}), updated_at = ?3
                WHERE documents.document_id = ?1
                  AND documents.active_job_id = ?2
                  AND ({BEST_SUCCEEDED_JOB_SQL}) IS NOT NULL
                "#
            ),
            params![document_id, job_id, now_iso()],
        )?;
        Ok(changed > 0)
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

/// 删 job 行的共用语句对:events 是 job 的从属行,必须与 jobs 同生共死。
fn delete_job_rows(tx: &rusqlite::Transaction<'_>, job_ids: &[String]) -> Result<()> {
    for job_id in job_ids {
        tx.execute("DELETE FROM events WHERE job_id = ?1", params![job_id])?;
        tx.execute("DELETE FROM jobs WHERE job_id = ?1", params![job_id])?;
    }
    Ok(())
}
