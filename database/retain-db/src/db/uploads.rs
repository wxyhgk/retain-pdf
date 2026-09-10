use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::params;

use crate::models::domain::UploadRecord;
use crate::storage_paths::{resolve_data_path, to_relative_data_path};

use super::Db;

impl Db {
    pub fn save_upload(&self, upload: &UploadRecord) -> Result<()> {
        let conn = self.connect()?;
        self.save_upload_on(&conn, upload)
    }

    /// Publish the upload and its document identity as one database commit.
    pub fn save_upload_with_document(&self, upload: &UploadRecord) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        self.save_upload_on(&tx, upload)?;
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
            .with_context(|| format!("upload not found: {upload_id}"))?;
        Ok(UploadRecord {
            stored_path: resolve_data_path(&self.data_root, &upload.stored_path)?
                .to_string_lossy()
                .to_string(),
            ..upload
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
