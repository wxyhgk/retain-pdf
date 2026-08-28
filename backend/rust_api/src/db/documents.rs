use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::domain::{now_iso, UploadRecord};
use crate::models::api::{BlockSearchHit, DocumentRecord, FavoriteRecord, FtsBlockRow};
use crate::storage_paths::resolve_data_path;

use super::Db;

impl Db {
    /// Tải lên trong hồ sơ:Chỉ có một hàm băm có cùng nội dung document,Chỉ tải lên trùng lặp thời gian làm mới và tên tệp。
    pub fn upsert_document_from_upload(&self, upload: &UploadRecord) -> Result<()> {
        if upload.content_hash.is_empty() {
            return Ok(());
        }
        let conn = self.connect()?;
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

    /// Bất kỳ job_id(Có lịch sử run VÀ -ocr Nhiệm vụ phụ)→ thuộc quyền document。
    /// Lịch sử mở Frontend job Khi không còn có thể dựa vào active_job_id Kiểm tra lại——Cái đó khớp với cái hiện tại
    /// có hiệu lực run,Sử học run sẽ âm thầm không khớp(Mục yêu thích không được lưu kho、Q&A Degradation Full Library)。
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

    pub fn update_favorite_note(&self, favorite_id: &str, note: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "UPDATE favorites SET note = ?1, updated_at = ?2 WHERE favorite_id = ?3",
            params![note, now_iso(), favorite_id],
        )?;
        Ok(changed > 0)
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
        // Phòng thủ:Danh sách thư viện không bao giờ trả về 0 upload Tài liệu mồ côi được hỗ trợ(Tệp nguồn bị mất
        // Lá bài Zombie)。"Chỉ chiều về"Tài liệu có upload Chỉ là không job,Không bị ảnh hưởng。
        let mut clauses: Vec<String> = vec![
            "EXISTS (SELECT 1 FROM uploads u WHERE u.content_hash = d.document_id AND u.content_hash <> '')"
                .to_string(),
        ];
        let mut args: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Some(status) = reading_status {
            clauses.push(format!("d.reading_status = ?{}", args.len() + 1));
            args.push(Box::new(status.to_string()));
        }
        if let Some(tag) = tag {
            clauses.push(format!(
                "EXISTS (SELECT 1 FROM document_tags t WHERE t.document_id = d.document_id AND t.tag = ?{})",
                args.len() + 1
            ));
            args.push(Box::new(tag.to_string()));
        }
        if let Some(collection_id) = collection_id {
            clauses.push(format!(
                "EXISTS (SELECT 1 FROM collection_documents c WHERE c.document_id = d.document_id AND c.collection_id = ?{})",
                args.len() + 1
            ));
            args.push(Box::new(collection_id.to_string()));
        }
        let where_sql = if clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", clauses.join(" AND "))
        };
        let sql = format!(
            "SELECT {DOCUMENT_COLUMNS} FROM documents d {where_sql} ORDER BY d.added_at DESC LIMIT ?{} OFFSET ?{}",
            args.len() + 1,
            args.len() + 2
        );
        args.push(Box::new(limit as i64));
        args.push(Box::new(offset as i64));
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(
            rusqlite::params_from_iter(args.iter().map(|value| value.as_ref())),
            row_to_document,
        )?;
        let mut documents = Vec::new();
        for row in rows {
            documents.push(row?);
        }
        for document in &mut documents {
            document.tags = load_document_tags(&conn, &document.document_id)?;
        }
        Ok(documents)
    }

    pub fn update_document_fields(
        &self,
        document_id: &str,
        title: Option<&str>,
        reading_status: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<DocumentRecord> {
        let conn = self.connect()?;
        let now = now_iso();
        if let Some(title) = title {
            conn.execute(
                "UPDATE documents SET title = ?1, updated_at = ?2 WHERE document_id = ?3",
                params![title, now, document_id],
            )?;
        }
        if let Some(status) = reading_status {
            conn.execute(
                "UPDATE documents SET reading_status = ?1, updated_at = ?2 WHERE document_id = ?3",
                params![status, now, document_id],
            )?;
        }
        if let Some(tags) = tags {
            conn.execute(
                "DELETE FROM document_tags WHERE document_id = ?1",
                params![document_id],
            )?;
            for tag in tags {
                let tag = tag.trim();
                if tag.is_empty() {
                    continue;
                }
                conn.execute(
                    "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                    params![document_id, tag],
                )?;
            }
        }
        let record = query_document(&conn, document_id)?
            .with_context(|| format!("document not found: {document_id}"))?;
        Ok(record)
    }

    /// cầm job Được quy cho document(Sau khi được chấp thuận của. upload.content_hash),trở lại document_id。
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

    /// án document_id(= content_hash) Đã tìm thấy nội dung tải lên gần，Đối với nguồn PDF / Trang bìa / dịch nhiều lần。
    pub fn find_upload_for_document(&self, document_id: &str) -> Result<Option<UploadRecord>> {
        let conn = self.connect()?;
        let upload = conn
            .query_row(
                r#"
                SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at,
                       developer_mode, content_hash
                FROM uploads
                WHERE content_hash = ?1 AND content_hash <> ''
                ORDER BY uploaded_at DESC
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

    /// Tất cả dưới tên của tài liệu này job_id(Sau khi được chấp thuận của. jobs.document_id Liên quan)。
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

    /// Tất cả các câu trả lời tương ứng upload Lịch sử(Cùng một tệp có thể được tải lên nhiều lần upload_id),
    /// stored_path Giải quyết thành đường dẫn tuyệt đối để xóa tệp đĩa。
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
        let changed = conn.execute("DELETE FROM uploads WHERE upload_id = ?1", params![upload_id])?;
        Ok(changed > 0)
    }

    pub fn favorites_count_for_document(&self, document_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE document_id = ?1",
            params![document_id],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }

    /// Xóa mục hàng tài liệu(FK Cascade Qing favorites/document_tags/collection_documents,
    /// ai_conversations.document_id đưa NULL)+ Có nguồn gốc blocks_fts đi。
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

    /// Sửa lỗi treo cổ active_job_id:Nếu nó chỉ đến job Không còn tồn tại,Tập trung vào tài liệu gần đây nhất theo tài liệu này
    /// thành công book job;Nếu không, hãy đặt NULL(Hạ cấp xuống bộ sưu tập sạch)。xóa job Bài đăng phải điều chỉnh,Thẻ chống zombie。
    pub fn reconcile_document_active_job(&self, document_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            UPDATE documents SET active_job_id = (
                SELECT j.job_id FROM jobs j
                WHERE j.document_id = documents.document_id
                  AND j.workflow <> '"ocr"'
                  AND j.status_json = '"succeeded"'
                ORDER BY j.finished_at DESC
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

    /// Xây dựng lại toàn bộ tài liệu FTS đi(Chỉ số dẫn xuất,Idempotent)。
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

    /// Truy xuất Toàn văn。trigram Truy vấn yêu cầu phân đoạn từ ≥3 ký tự,Dự phòng truy vấn ngắn hơn LIKE quét xem。
    /// `document_id` Chỉ tìm kiếm tài liệu này khi nó không trống（Đầu đọc / AI Toàn bộ phần hỏi đáp）。
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
            let rows =
                stmt.query_map(params![pattern, doc_id, limit as i64], row_to_search_hit)?;
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

    pub fn save_favorite(&self, favorite: &FavoriteRecord) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO favorites (
                favorite_id, document_id, job_id, page_idx, block_id,
                char_start, char_end, kind, quote_text, translated_quote_text,
                note, asset_id, rect_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(favorite_id) DO UPDATE SET
                kind=excluded.kind,
                quote_text=excluded.quote_text,
                translated_quote_text=excluded.translated_quote_text,
                note=excluded.note,
                asset_id=excluded.asset_id,
                rect_json=excluded.rect_json,
                updated_at=excluded.updated_at
            "#,
            params![
                favorite.favorite_id,
                favorite.document_id,
                favorite.job_id,
                favorite.page_idx,
                favorite.block_id,
                favorite.char_start,
                favorite.char_end,
                favorite.kind,
                favorite.quote_text,
                favorite.translated_quote_text,
                favorite.note,
                favorite.asset_id,
                favorite.rect_json,
                favorite.created_at,
                favorite.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_favorites(&self, document_id: Option<&str>) -> Result<Vec<FavoriteRecord>> {
        let conn = self.connect()?;
        let (sql, args): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = match document_id {
            Some(id) => (
                "SELECT favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, asset_id, rect_json, created_at, updated_at FROM favorites WHERE document_id = ?1 ORDER BY page_idx, created_at",
                vec![Box::new(id.to_string())],
            ),
            None => (
                "SELECT favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, asset_id, rect_json, created_at, updated_at FROM favorites ORDER BY created_at DESC",
                Vec::new(),
            ),
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(
            rusqlite::params_from_iter(args.iter().map(|value| value.as_ref())),
            row_to_favorite,
        )?;
        let mut favorites = Vec::new();
        for row in rows {
            favorites.push(row?);
        }
        Ok(favorites)
    }

    pub fn delete_favorite(&self, favorite_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM favorites WHERE favorite_id = ?1",
            params![favorite_id],
        )?;
        Ok(changed > 0)
    }

    /// Tham chiếu bởi Anchor yêu thích job Không cho phép xóa riêng lẻ(Bảo vệ không gian khối neo)。
    pub fn favorites_referencing_job(&self, job_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE job_id = ?1",
            params![job_id],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }

    /// Đắp đất dự trữ:Thư viện cựu chiến binh được nâng cấp lên mô hình thư viện。Nhàn rỗi và chỉ hoạt động khi có khoảng trống,
    /// Khởi nghiệp ở trạng thái ổn định chỉ trả một vài COUNT Chi phí。
    pub(super) fn backfill_library_records(&self) -> Result<()> {
        self.backfill_upload_hashes()?;
        self.backfill_job_document_links()?;
        self.backfill_active_jobs()?;
        self.backfill_fts_indexes()?;
        self.cleanup_orphan_documents()?;
        Ok(())
    }

    /// Dọn dẹp các tài liệu mồ côi trong một lần:Không upload chống đỡ(Tệp nguồn đã tồn tại từ lâu retention GC rơi)
    /// Hàng tài liệu,là một lá bài zombie không bao giờ mở ra.。Chỉ trích dẫn rõ ràng không có bộ sưu tập——Có hạ cấp yêu thích
    /// Dữ liệu được người dùng lưu giữ qua DELETE /documents/:id Xử lý rõ ràng,Không phá hủy im lặng nội dung được tuyển chọn。
    /// root-cause(retention Không xóa lại document-backed upload)Trại trẻ mồ côi mới bị chặn,
    /// Việc dọn dẹp này chỉ liên quan đến các di sản lịch sử。
    fn cleanup_orphan_documents(&self) -> Result<()> {
        let conn = self.connect()?;
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

    fn backfill_fts_indexes(&self) -> Result<()> {
        let conn = self.connect()?;
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
            let job_root = self.data_root.join("jobs").join(&job_id);
            match build_fts_rows_from_job_dir(&job_root) {
                Ok(rows) => {
                    if let Err(error) = self.replace_document_fts(&document_id, &job_id, &rows) {
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

    fn backfill_upload_hashes(&self) -> Result<()> {
        let conn = self.connect()?;
        let pending: Vec<(String, String)> = {
            let mut stmt = conn.prepare(
                "SELECT upload_id, stored_path FROM uploads WHERE content_hash = '' OR content_hash IS NULL",
            )?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
            rows.collect::<std::result::Result<Vec<_>, _>>()?
        };
        for (upload_id, stored_path) in pending {
            let resolved = match resolve_data_path(&self.data_root, &stored_path) {
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
            let upload = self.get_upload(&upload_id)?;
            self.upsert_document_from_upload(&upload)?;
        }
        Ok(())
    }

    fn backfill_job_document_links(&self) -> Result<()> {
        let conn = self.connect()?;
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
        Ok(())
    }

    fn backfill_active_jobs(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            UPDATE documents SET active_job_id = (
                SELECT j.job_id FROM jobs j
                WHERE j.document_id = documents.document_id
                  AND j.status_json = '"succeeded"'
                  AND j.workflow <> '"ocr"'
                ORDER BY j.finished_at DESC
                LIMIT 1
            )
            WHERE documents.active_job_id IS NULL
            "#,
            [],
        )?;
        Ok(())
    }
}

/// sha2 0.11 Loại đầu ra của không còn được triển khai LowerHex,Mã hóa hex thủ công hợp nhất。
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

const DOCUMENT_COLUMNS: &str = "d.document_id, d.title, d.authors_json, d.year, d.doi, d.source_filename, d.page_count, d.bytes, d.active_job_id, d.reading_status, d.added_at, d.last_opened_at, d.updated_at";

fn default_title_from_filename(filename: &str) -> String {
    filename
        .strip_suffix(".pdf")
        .or_else(|| filename.strip_suffix(".PDF"))
        .unwrap_or(filename)
        .trim()
        .to_string()
}

fn query_document(conn: &Connection, document_id: &str) -> Result<Option<DocumentRecord>> {
    let record = conn
        .query_row(
            &format!("SELECT {DOCUMENT_COLUMNS} FROM documents d WHERE d.document_id = ?1"),
            params![document_id],
            row_to_document,
        )
        .optional()?;
    let Some(mut record) = record else {
        return Ok(None);
    };
    record.tags = load_document_tags(conn, document_id)?;
    Ok(Some(record))
}

fn load_document_tags(conn: &Connection, document_id: &str) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT tag FROM document_tags WHERE document_id = ?1 ORDER BY tag")?;
    let rows = stmt.query_map(params![document_id], |row| row.get::<_, String>(0))?;
    let mut tags = Vec::new();
    for row in rows {
        tags.push(row?);
    }
    Ok(tags)
}

fn row_to_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentRecord> {
    Ok(DocumentRecord {
        document_id: row.get(0)?,
        title: row.get(1)?,
        authors_json: row.get(2)?,
        year: row.get(3)?,
        doi: row.get(4)?,
        source_filename: row.get(5)?,
        page_count: row.get::<_, i64>(6)? as u32,
        bytes: row.get::<_, i64>(7)? as u64,
        active_job_id: row.get(8)?,
        reading_status: row.get(9)?,
        added_at: row.get(10)?,
        last_opened_at: row.get(11)?,
        updated_at: row.get(12)?,
        tags: Vec::new(),
        source_pdf_url: String::new(),
        cover_url: String::new(),
        thumbnail_url: String::new(),
    })
}

fn row_to_search_hit(row: &rusqlite::Row<'_>) -> rusqlite::Result<BlockSearchHit> {
    Ok(BlockSearchHit {
        document_id: row.get(0)?,
        job_id: row.get(1)?,
        page_idx: row.get(2)?,
        block_id: row.get(3)?,
        source_snippet: row.get(4)?,
        translated_snippet: row.get(5)?,
    })
}

fn row_to_favorite(row: &rusqlite::Row<'_>) -> rusqlite::Result<FavoriteRecord> {
    Ok(FavoriteRecord {
        favorite_id: row.get(0)?,
        document_id: row.get(1)?,
        job_id: row.get(2)?,
        page_idx: row.get(3)?,
        block_id: row.get(4)?,
        char_start: row.get(5)?,
        char_end: row.get(6)?,
        kind: row.get(7)?,
        quote_text: row.get(8)?,
        translated_quote_text: row.get(9)?,
        note: row.get(10)?,
        asset_id: row.get(11)?,
        rect_json: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

/// xây dựng tài liệu từ danh mục sản phẩm nhiệm vụ FTS đi:
/// - `ocr/normalized/document.v1.json` cung cấp source_text và thông số kỹ thuật block_id;
/// - `translated/page-*.json` cung cấp translated_text,án (page_idx, block_idx)
///   Căn chỉnh chỉ mục kỹ thuật số (item_id của bản dịch và thông số kỹ thuật block_id có số lượng bit đệm 0 khác nhau giữa các bên, không thể so khớp trực tiếp).
///   Căn chỉnh chuỗi)。
/// Chỉ có văn bản gốc được lập chỉ mục khi bản dịch bị thiếu。
pub fn build_fts_rows_from_job_dir(job_root: &Path) -> Result<Vec<FtsBlockRow>> {
    let normalized_path = job_root.join("ocr").join("normalized").join("document.v1.json");
    let raw = std::fs::read_to_string(&normalized_path)
        .with_context(|| format!("read {}", normalized_path.display()))?;
    let document: serde_json::Value = serde_json::from_str(&raw)?;

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
            let source_text = block
                .get("text")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string();
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

fn value_as_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    let value = value?;
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    value.as_str()?.trim().parse::<i64>().ok()
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;

    struct TestDbFs {
        root: PathBuf,
        data_root: PathBuf,
        db_path: PathBuf,
    }

    impl TestDbFs {
        fn new(test_name: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "rust-api-db-documents-{test_name}-{}",
                fastrand::u64(..)
            ));
            let data_root = root.join("data");
            let db_path = root.join("db").join("jobs.db");
            fs::create_dir_all(&data_root).expect("create data root");
            fs::create_dir_all(db_path.parent().expect("db parent")).expect("create db dir");
            Self {
                root,
                data_root,
                db_path,
            }
        }

        fn db(&self) -> Db {
            Db::new(self.db_path.clone(), self.data_root.clone())
        }
    }

    impl Drop for TestDbFs {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn upload_with_hash(upload_id: &str, hash: &str) -> UploadRecord {
        UploadRecord {
            upload_id: upload_id.to_string(),
            filename: "paper.pdf".to_string(),
            stored_path: "uploads/x/paper.pdf".to_string(),
            bytes: 10,
            page_count: 3,
            uploaded_at: now_iso(),
            developer_mode: false,
            content_hash: hash.to_string(),
        }
    }

    fn favorite_for(document_id: &str, job_id: &str, favorite_id: &str) -> FavoriteRecord {
        FavoriteRecord {
            favorite_id: favorite_id.to_string(),
            document_id: document_id.to_string(),
            job_id: job_id.to_string(),
            page_idx: 4,
            block_id: "p005-b0008".to_string(),
            char_start: None,
            char_end: None,
            kind: "sentence".to_string(),
            quote_text: "quoted source".to_string(),
            translated_quote_text: "Bản chụp trích dẫn".to_string(),
            note: String::new(),
            asset_id: String::new(),
            rect_json: String::new(),
            created_at: now_iso(),
            updated_at: now_iso(),
        }
    }

    #[test]
    fn versioned_migrations_are_idempotent() {
        let fs = TestDbFs::new("migrations");
        let db = fs.db();
        db.init().expect("first init");
        db.init().expect("second init");
        let conn = rusqlite::Connection::open(&fs.db_path).expect("open");
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("user_version");
        // Đồng bộ hóa với chiều dài mảng di chuyển:v1 Quỹ Thư viện + v2 tài sản/Phiên chạy
        assert_eq!(version, 2);
    }

    #[test]
    fn same_content_hash_upserts_single_document() {
        let fs = TestDbFs::new("dedupe");
        let db = fs.db();
        db.init().expect("init");
        let hash = sha256_hex(b"same pdf bytes");
        // Đường dẫn sản xuất:save_upload trước upsert_document(Liệt kê các phụ thuộc của bộ lọc upload tồn tại)
        let up1 = upload_with_hash("up-1", &hash);
        db.save_upload(&up1).expect("save up-1");
        db.upsert_document_from_upload(&up1).expect("first upsert");
        let up2 = upload_with_hash("up-2", &hash);
        db.save_upload(&up2).expect("save up-2");
        db.upsert_document_from_upload(&up2).expect("second upsert");
        let documents = db
            .list_documents(10, 0, None, None, None)
            .expect("list documents");
        assert_eq!(documents.len(), 1);
        assert_eq!(documents[0].document_id, hash);
        assert_eq!(documents[0].title, "paper");
    }

    #[test]
    fn document_delete_cascades_favorites() {
        let fs = TestDbFs::new("cascade");
        let db = fs.db();
        db.init().expect("init");
        let hash = sha256_hex(b"cascade doc");
        db.upsert_document_from_upload(&upload_with_hash("up-1", &hash))
            .expect("upsert");
        db.save_favorite(&favorite_for(&hash, "job-1", "fav-1"))
            .expect("save favorite");
        assert_eq!(db.favorites_referencing_job("job-1").expect("count"), 1);
        let conn = db.connect().expect("connect");
        conn.execute("DELETE FROM documents WHERE document_id = ?1", params![hash])
            .expect("delete document");
        assert_eq!(db.list_favorites(None).expect("list").len(), 0);
    }

    #[test]
    fn fts_trigram_matches_chinese_and_short_query_falls_back() {
        let fs = TestDbFs::new("fts");
        let db = fs.db();
        db.init().expect("init");
        let hash = sha256_hex(b"fts doc");
        db.upsert_document_from_upload(&upload_with_hash("up-1", &hash))
            .expect("upsert");
        db.replace_document_fts(
            &hash,
            "job-1",
            &[FtsBlockRow {
                page_idx: 2,
                block_id: "p003-b0001".to_string(),
                source_text: "vibrationally resolved optical spectra".to_string(),
                translated_text: "振动分辨光学光谱的有效计算方法".to_string(),
            }],
        )
        .expect("fts insert");
        let hits = db.search_blocks("光学光谱", 10, None).expect("search zh");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].document_id, hash);
        assert_eq!(hits[0].page_idx, 2);
        assert_eq!(hits[0].block_id, "p003-b0001");
        // 2 ký tự truy vấn vẫn khớp nhờ FTS5 tokenize='trigram'
        let short_hits = db.search_blocks("光谱", 10, None).expect("search short");
        assert_eq!(short_hits.len(), 1);
        // Lọc theo document: document_id không tồn tại sẽ không có kết quả
        let scoped_miss = db
            .search_blocks("光学光谱", 10, Some("no-such-doc"))
            .expect("search scoped miss");
        assert!(scoped_miss.is_empty());
        let scoped_hit = db
            .search_blocks("光学光谱", 10, Some(&hash))
            .expect("search scoped hit");
        assert_eq!(scoped_hit.len(), 1);
        // Xây dựng lại Idempotency:Chỉ còn lại một hàng sau khi thay thế nó một lần nữa
        db.replace_document_fts(
            &hash,
            "job-2",
            &[FtsBlockRow {
                page_idx: 2,
                block_id: "p003-b0001".to_string(),
                source_text: "updated".to_string(),
                translated_text: "更新后的光学光谱".to_string(),
            }],
        )
        .expect("fts rebuild");
        let rebuilt = db.search_blocks("光学光谱", 10, None).expect("search rebuilt");
        assert_eq!(rebuilt.len(), 1);
        assert_eq!(rebuilt[0].job_id, "job-2");
    }

    #[test]
    fn update_document_fields_manages_tags_and_status() {
        let fs = TestDbFs::new("patch");
        let db = fs.db();
        db.init().expect("init");
        let hash = sha256_hex(b"patch doc");
        let up = upload_with_hash("up-1", &hash);
        db.save_upload(&up).expect("save upload");
        db.upsert_document_from_upload(&up).expect("upsert");
        let updated = db
            .update_document_fields(
                &hash,
                Some("光谱计算方法综述"),
                Some("reading"),
                Some(&["化学".to_string(), "光谱".to_string()]),
            )
            .expect("patch");
        assert_eq!(updated.title, "光谱计算方法综述");
        assert_eq!(updated.reading_status, "reading");
        assert_eq!(updated.tags, vec!["光谱".to_string(), "化学".to_string()]);
        let filtered = db
            .list_documents(10, 0, None, Some("化学"), None)
            .expect("list by tag");
        assert_eq!(filtered.len(), 1);
        let missed = db
            .list_documents(10, 0, None, Some("生物"), None)
            .expect("list by other tag");
        assert!(missed.is_empty());
    }
}
