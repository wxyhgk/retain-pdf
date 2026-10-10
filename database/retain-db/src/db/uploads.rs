use std::collections::HashMap;
use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::params;

use crate::models::domain::UploadRecord;
use crate::storage_paths::{resolve_data_path, to_relative_data_path};

use super::Db;

impl Db {
    /// Fetch optional display metadata for a page in one query. Missing or
    /// malformed records are omitted so callers retain their per-job fallback.
    /// A JSON array keeps the bind count constant even for large ID selections.
    pub fn get_uploads(&self, upload_ids: &[&str]) -> Result<HashMap<String, UploadRecord>> {
        if upload_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let conn = self.connect()?;
        #[cfg(test)]
        BATCH_UPLOAD_QUERIES.with(|count| count.set(count.get() + 1));
        let mut stmt = conn.prepare(
            "SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash FROM uploads WHERE upload_id IN (SELECT value FROM json_each(?1))",
        )?;
        let rows = stmt.query_map(params![serde_json::to_string(upload_ids)?], upload_from_row)?;
        let mut uploads = HashMap::new();
        for row in rows {
            let Ok(mut upload) = row else { continue };
            let Ok(path) = resolve_data_path(&self.data_root, &upload.stored_path) else {
                continue;
            };
            upload.stored_path = path.to_string_lossy().into_owned();
            uploads.insert(upload.upload_id.clone(), upload);
        }
        Ok(uploads)
    }

    pub fn save_upload(&self, upload: &UploadRecord) -> Result<()> {
        let conn = self.connect()?;
        self.save_upload_on(&conn, upload)
    }

    /// Publish the upload and its document identity as one database commit.
    pub fn save_upload_with_document(&self, upload: &UploadRecord) -> Result<()> {
        self.save_upload_with_document_for(upload, crate::db::LOCAL_OWNER)
    }

    /// 同上，并记下归属；书的归属由触发器从这条上传继承，所以要在同一事务里先写归属。
    pub fn save_upload_with_document_for(&self, upload: &UploadRecord, owner: &str) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        self.save_upload_on(&tx, upload)?;
        tx.execute(
            "UPDATE uploads SET owner_user_id = ?2 WHERE upload_id = ?1",
            params![upload.upload_id, owner],
        )?;
        Self::upsert_document_from_upload_on(&tx, upload)?;
        tx.commit()?;
        Ok(())
    }

    fn save_upload_on(&self, conn: &rusqlite::Connection, upload: &UploadRecord) -> Result<()> {
        let stored_path = to_relative_data_path(&self.data_root, Path::new(&upload.stored_path))?;
        conn.execute(
            r#"
            INSERT INTO uploads (
                upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(upload_id) DO UPDATE SET
                filename=excluded.filename,
                stored_path=excluded.stored_path,
                bytes=excluded.bytes,
                page_count=excluded.page_count,
                uploaded_at=excluded.uploaded_at,
                developer_mode=excluded.developer_mode,
                content_hash=excluded.content_hash
            "#,
            params![
                upload.upload_id,
                upload.filename,
                stored_path,
                upload.bytes as i64,
                upload.page_count as i64,
                upload.uploaded_at,
                if upload.developer_mode { 1 } else { 0 },
                upload.content_hash,
            ],
        )?;
        Ok(())
    }

    pub fn get_upload(&self, upload_id: &str) -> Result<UploadRecord> {
        let conn = self.connect()?;
        let upload = conn
            .query_row(
                "SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash FROM uploads WHERE upload_id = ?1",
                params![upload_id],
                upload_from_row,
            )
            .with_context(|| format!("upload not found: {upload_id}"))?;
        Ok(UploadRecord {
            stored_path: resolve_data_path(&self.data_root, &upload.stored_path)?
                .to_string_lossy()
                .to_string(),
            ..upload
        })
    }
}

fn upload_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<UploadRecord> {
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
}

#[cfg(test)]
thread_local! {
    static BATCH_UPLOAD_QUERIES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_upload_metadata_uses_one_query_and_isolates_invalid_rows() {
        let root = std::env::temp_dir().join(format!("retain-upload-page-{}", fastrand::u64(..)));
        let db = Db::new(root.join("jobs.db"), root.clone());
        let conn = db.connect().unwrap();
        conn.execute_batch(
            "WITH RECURSIVE ids(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM ids WHERE n < 500)
             INSERT INTO uploads (upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash)
             SELECT 'upload-' || n, 'paper-' || n || '.pdf', 'uploads/' || n || '.pdf', n * 10, n, 'now', 0, '' FROM ids;
             UPDATE uploads SET page_count = 'broken' WHERE upload_id = 'upload-2';
             UPDATE uploads SET stored_path = '../escape.pdf' WHERE upload_id = 'upload-3';",
        ).unwrap();
        let mut ids: Vec<String> = (1..=500).map(|n| format!("upload-{n}")).collect();
        ids.extend(["upload-1".into(), "missing".into()]);
        BATCH_UPLOAD_QUERIES.with(|count| count.set(0));
        let uploads = db
            .get_uploads(&ids.iter().map(String::as_str).collect::<Vec<_>>())
            .unwrap();
        assert_eq!(BATCH_UPLOAD_QUERIES.with(|count| count.get()), 1);
        assert_eq!(uploads.len(), 498);
        assert_eq!(uploads["upload-1"].filename, "paper-1.pdf");
        assert_eq!(uploads["upload-500"].page_count, 500);
        assert_eq!(uploads["upload-500"].bytes, 5_000);
        assert_eq!(
            uploads["upload-1"].stored_path,
            root.join("uploads/1.pdf").to_string_lossy()
        );
        assert!(db.get_upload("upload-2").is_err());
        assert!(db.get_upload("upload-3").is_err());
        assert!(db.get_uploads(&[]).unwrap().is_empty());
        assert_eq!(BATCH_UPLOAD_QUERIES.with(|count| count.get()), 1);
        drop(conn);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn upload_and_document_publish_rolls_back_and_preserves_deduplication() {
        let root = std::env::temp_dir().join(format!("retain-upload-tx-{}", fastrand::u64(..)));
        std::fs::create_dir_all(&root).unwrap();
        let db = Db::new(root.join("jobs.db"), root.clone());
        let mut upload = UploadRecord {
            upload_id: "first".into(),
            filename: "first.pdf".into(),
            stored_path: root.join("first.pdf").to_string_lossy().into_owned(),
            bytes: 20,
            page_count: 1,
            uploaded_at: crate::models::domain::now_iso(),
            developer_mode: false,
            content_hash: "synthetic-content".into(),
        };
        let conn = db.connect().unwrap();
        conn.execute_batch("CREATE TRIGGER reject_document BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;").unwrap();
        assert!(db.save_upload_with_document(&upload).is_err());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM uploads", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM documents", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
        conn.execute_batch("DROP TRIGGER reject_document").unwrap();
        db.save_upload_with_document(&upload).unwrap();
        upload.upload_id = "second".into();
        upload.filename = "second.pdf".into();
        db.save_upload_with_document(&upload).unwrap();
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM uploads", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            2
        );
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM documents", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(db.get_upload("second").unwrap().filename, "second.pdf");
        assert_eq!(
            db.get_document("synthetic-content")
                .unwrap()
                .source_filename,
            "second.pdf"
        );
        drop(conn);
        std::fs::remove_dir_all(root).unwrap();
    }
}
