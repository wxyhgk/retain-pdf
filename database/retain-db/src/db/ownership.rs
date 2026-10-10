//! 数据归属（多用户模式）。每张根表一列 owner_user_id，默认 'local'（单机模式的本机用户）。
//! 任务和书的归属由触发器在插入时继承（见 schema/migrations/v22_data_ownership.sql）；这里提供查归属、改归属，
//! 以及按归属过滤的列表。

use anyhow::Result;
use rusqlite::{params, OptionalExtension};

use crate::models::domain::GlossaryRecord;
use crate::models::api::CollectionRecord;

use super::collections::{row_to_collection, COLLECTION_COLUMNS};
use super::rows::row_to_glossary_record;
use super::Db;

/// 有归属的资源种类。路径参数、请求体里出现这些编号时都要核对归属。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OwnedKind {
    Upload,
    Job,
    Document,
    Glossary,
    Collection,
}

impl OwnedKind {
    fn table_and_key(self) -> (&'static str, &'static str) {
        match self {
            Self::Upload => ("uploads", "upload_id"),
            Self::Job => ("jobs", "job_id"),
            Self::Document => ("documents", "document_id"),
            Self::Glossary => ("glossaries", "glossary_id"),
            Self::Collection => ("collections", "collection_id"),
        }
    }
}

impl Db {
    /// 资源的归属；资源不存在返回 None。
    pub fn resource_owner(&self, kind: OwnedKind, id: &str) -> Result<Option<String>> {
        let (table, key) = kind.table_and_key();
        let conn = self.connect()?;
        let owner = conn
            .query_row(&format!("SELECT owner_user_id FROM {table} WHERE {key} = ?1"), params![id], |row| row.get(0))
            .optional()?;
        if owner.is_some() || kind != OwnedKind::Document {
            return Ok(owner);
        }
        // 书的编号也可能只在上传里出现（还没建 documents 行的旧数据）。
        Ok(conn
            .query_row(
                "SELECT owner_user_id FROM uploads WHERE content_hash = ?1 ORDER BY uploaded_at LIMIT 1",
                params![id],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn set_resource_owner(&self, kind: OwnedKind, id: &str, owner: &str) -> Result<bool> {
        let (table, key) = kind.table_and_key();
        let conn = self.connect()?;
        let updated = conn.execute(&format!("UPDATE {table} SET owner_user_id = ?2 WHERE {key} = ?1"), params![id, owner])?;
        Ok(updated > 0)
    }

    /// 新任务的归属跟着它派生自的那个任务（触发器只认 source.artifact_job_id；OCR 重试这类只在调用方
    /// 知道源头的，由调用方补）。只改还是默认 'local' 的。
    pub fn inherit_job_owner(&self, job_id: &str, from_job_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE jobs SET owner_user_id = (SELECT owner_user_id FROM jobs WHERE job_id = ?2) \
             WHERE job_id = ?1 AND owner_user_id = 'local' AND EXISTS (SELECT 1 FROM jobs WHERE job_id = ?2)",
            params![job_id, from_job_id],
        )?;
        Ok(())
    }

    pub fn job_ids_for_owner(&self, owner: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT job_id FROM jobs WHERE owner_user_id = ?1")?;
        let rows = stmt.query_map(params![owner], |row| row.get(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<String>>>()?)
    }

    pub fn list_collections_for_owner(&self, owner: Option<&str>) -> Result<Vec<CollectionRecord>> {
        let Some(owner) = owner else {
            return self.list_collections();
        };
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLLECTION_COLUMNS} FROM collections c WHERE c.owner_user_id = ?1 \
             ORDER BY c.sort_order ASC, c.created_at ASC"
        ))?;
        let rows = stmt.query_map(params![owner], row_to_collection)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn list_glossaries_for_owner(&self, owner: Option<&str>) -> Result<Vec<GlossaryRecord>> {
        let Some(owner) = owner else {
            return self.list_glossaries();
        };
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT glossary_id, name, description, source_lang, target_lang, enabled, entries_json, created_at, updated_at \
             FROM glossaries WHERE owner_user_id = ?1 ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![owner], row_to_glossary_record)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::UploadRecord;

    fn db() -> (Db, std::path::PathBuf) {
        let root = std::env::temp_dir().join(format!("retain-ownership-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("uploads")).unwrap();
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        (db, root)
    }

    fn upload(root: &std::path::Path, upload_id: &str, hash: &str) -> UploadRecord {
        let path = root.join("uploads").join(format!("{upload_id}.pdf"));
        std::fs::write(&path, b"%PDF").unwrap();
        UploadRecord {
            upload_id: upload_id.into(),
            filename: "a.pdf".into(),
            stored_path: path.to_string_lossy().into_owned(),
            bytes: 4,
            page_count: 1,
            uploaded_at: "2026-10-10T00:00:00Z".into(),
            developer_mode: false,
            content_hash: hash.into(),
        }
    }

    fn insert_job(db: &Db, job_id: &str, upload_id: &str, request_json: &str) {
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json, upload_id)
                 VALUES(?1, '\"book\"', '\"queued\"', 't', 't', '[]', ?2, '[]', NULLIF(?3, ''))",
                params![job_id, request_json, upload_id],
            )
            .unwrap();
    }

    #[test]
    fn jobs_and_documents_inherit_the_upload_owner() {
        let (db, root) = db();
        db.save_upload_with_document_for(&upload(&root, "up1", "hash-u1"), "u1").unwrap();
        assert_eq!(db.resource_owner(OwnedKind::Upload, "up1").unwrap().as_deref(), Some("u1"));
        assert_eq!(db.resource_owner(OwnedKind::Document, "hash-u1").unwrap().as_deref(), Some("u1"));

        insert_job(&db, "j1", "up1", "{}");
        assert_eq!(db.resource_owner(OwnedKind::Job, "j1").unwrap().as_deref(), Some("u1"));
        // 重新渲染、续跑这类没有上传、只带源任务的。
        insert_job(&db, "j2", "", r#"{"source":{"artifact_job_id":"j1"}}"#);
        assert_eq!(db.resource_owner(OwnedKind::Job, "j2").unwrap().as_deref(), Some("u1"));
        insert_job(&db, "j3", "", r#"{"source":{"artifact_job_id":"j2"}}"#);
        assert_eq!(db.resource_owner(OwnedKind::Job, "j3").unwrap().as_deref(), Some("u1"));
        // 坏 JSON 不能让插入失败；归不到就是 local。
        insert_job(&db, "j4", "", "not json");
        assert_eq!(db.resource_owner(OwnedKind::Job, "j4").unwrap().as_deref(), Some("local"));
        db.inherit_job_owner("j4", "j1").unwrap();
        assert_eq!(db.resource_owner(OwnedKind::Job, "j4").unwrap().as_deref(), Some("u1"));
        assert_eq!(db.resource_owner(OwnedKind::Job, "missing").unwrap(), None);
    }

    #[test]
    fn upserting_a_job_keeps_its_owner() {
        let (db, _root) = db();
        insert_job(&db, "j1", "", "{}");
        db.set_resource_owner(OwnedKind::Job, "j1", "u2").unwrap();
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json)
                 VALUES('j1', '\"book\"', '\"running\"', 't', 't2', '[]', '{}', '[]')
                 ON CONFLICT(job_id) DO UPDATE SET status_json = excluded.status_json",
                [],
            )
            .unwrap();
        assert_eq!(db.resource_owner(OwnedKind::Job, "j1").unwrap().as_deref(), Some("u2"));
    }

    #[test]
    fn single_mode_rows_default_to_local() {
        let (db, root) = db();
        db.save_upload_with_document(&upload(&root, "up1", "hash-a")).unwrap();
        insert_job(&db, "j1", "up1", "{}");
        assert_eq!(db.resource_owner(OwnedKind::Job, "j1").unwrap().as_deref(), Some("local"));
        assert_eq!(db.resource_owner(OwnedKind::Document, "hash-a").unwrap().as_deref(), Some("local"));
    }
}
