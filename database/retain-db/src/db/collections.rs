use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension};

use crate::models::api::CollectionRecord;
use crate::models::domain::now_iso;

use super::Db;

const COLLECTION_COLUMNS: &str = "c.collection_id, c.name, c.parent_id, c.sort_order, c.created_at,
     (SELECT COUNT(*) FROM collection_documents cd WHERE cd.collection_id = c.collection_id)";

impl Db {
    pub fn create_collection(
        &self,
        collection_id: &str,
        name: &str,
        parent_id: Option<&str>,
    ) -> Result<CollectionRecord> {
        let conn = self.connect()?;
        let now = now_iso();
        // 新文件夹排到末尾:取当前最大 sort_order + 1(空表则从 0 开始)。
        let next_sort_order: i64 = conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM collections",
            [],
            |row| row.get(0),
        )?;
        conn.execute(
            r#"
            INSERT INTO collections (collection_id, name, parent_id, sort_order, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![collection_id, name, parent_id, next_sort_order, now],
        )?;
        self.get_collection(collection_id)?
            .context("collection vanished after insert")
    }

    pub fn get_collection(&self, collection_id: &str) -> Result<Option<CollectionRecord>> {
        let conn = self.connect()?;
        let record = conn
            .query_row(
                &format!(
                    "SELECT {COLLECTION_COLUMNS} FROM collections c WHERE c.collection_id = ?1"
                ),
                params![collection_id],
                row_to_collection,
            )
            .optional()?;
        Ok(record)
    }

    pub fn list_collections(&self) -> Result<Vec<CollectionRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLLECTION_COLUMNS} FROM collections c ORDER BY c.sort_order ASC, c.created_at ASC"
        ))?;
        let rows = stmt.query_map([], row_to_collection)?;
        let mut collections = Vec::new();
        for row in rows {
            collections.push(row?);
        }
        Ok(collections)
    }

    /// 改名和/或调整排序位置,两个字段都可选、按需更新;更新后返回最新记录
    /// (记录不存在时报错,路由层转 404)。
    pub fn update_collection(
        &self,
        collection_id: &str,
        name: Option<&str>,
        sort_order: Option<i64>,
    ) -> Result<CollectionRecord> {
        let conn = self.connect()?;
        if let Some(name) = name {
            conn.execute(
                "UPDATE collections SET name = ?1 WHERE collection_id = ?2",
                params![name, collection_id],
            )?;
        }
        if let Some(sort_order) = sort_order {
            conn.execute(
                "UPDATE collections SET sort_order = ?1 WHERE collection_id = ?2",
                params![sort_order, collection_id],
            )?;
        }
        self.get_collection(collection_id)?
            .with_context(|| format!("collection not found: {collection_id}"))
    }

    /// 删除文件夹本身;collection_documents 的归属行随 ON DELETE CASCADE 自动清掉,
    /// 文档记录本身不受影响。
    pub fn delete_collection(&self, collection_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM collections WHERE collection_id = ?1",
            params![collection_id],
        )?;
        Ok(changed > 0)
    }

    /// 批量加入文档;同一 (collection_id, document_id) 已存在则跳过(幂等)。
    pub fn add_documents_to_collection(
        &self,
        collection_id: &str,
        document_ids: &[String],
    ) -> Result<()> {
        let mut conn = self.connect()?;
        let now = now_iso();
        let tx = conn.transaction()?;
        for document_id in document_ids {
            tx.execute(
                r#"
                INSERT OR IGNORE INTO collection_documents (collection_id, document_id, added_at)
                VALUES (?1, ?2, ?3)
                "#,
                params![collection_id, document_id, now],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn remove_document_from_collection(
        &self,
        collection_id: &str,
        document_id: &str,
    ) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM collection_documents WHERE collection_id = ?1 AND document_id = ?2",
            params![collection_id, document_id],
        )?;
        Ok(changed > 0)
    }
}

fn row_to_collection(row: &rusqlite::Row<'_>) -> rusqlite::Result<CollectionRecord> {
    Ok(CollectionRecord {
        collection_id: row.get(0)?,
        name: row.get(1)?,
        parent_id: row.get(2)?,
        sort_order: row.get(3)?,
        created_at: row.get(4)?,
        document_count: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::db::documents::sha256_hex;
    use crate::models::domain::UploadRecord;

    struct TestDbFs {
        root: PathBuf,
        data_root: PathBuf,
        db_path: PathBuf,
    }

    impl TestDbFs {
        fn new(test_name: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "rust-api-db-collections-{test_name}-{}",
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

    #[test]
    fn create_list_rename_delete_roundtrip() {
        let fs = TestDbFs::new("collections-crud");
        let db = fs.db();
        db.init().expect("init");

        let a = db
            .create_collection("col-a", "化学", None)
            .expect("create a");
        assert_eq!(a.sort_order, 0);
        assert_eq!(a.document_count, 0);

        let b = db
            .create_collection("col-b", "机器学习", None)
            .expect("create b");
        assert_eq!(b.sort_order, 1);

        let listed = db.list_collections().expect("list");
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].collection_id, "col-a");
        assert_eq!(listed[1].collection_id, "col-b");

        let renamed = db
            .update_collection("col-a", Some("有机化学"), None)
            .expect("rename");
        assert_eq!(renamed.name, "有机化学");

        let reordered = db
            .update_collection("col-a", None, Some(5))
            .expect("reorder");
        assert_eq!(reordered.sort_order, 5);

        assert!(db.delete_collection("col-b").expect("delete b"));
        let listed = db.list_collections().expect("list after delete");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].collection_id, "col-a");
    }

    #[test]
    fn update_missing_collection_errors() {
        let fs = TestDbFs::new("collections-missing");
        let db = fs.db();
        db.init().expect("init");
        let err = db.update_collection("no-such", Some("x"), None);
        assert!(err.is_err());
    }

    #[test]
    fn add_remove_documents_tracks_document_count() {
        let fs = TestDbFs::new("collections-membership");
        let db = fs.db();
        db.init().expect("init");
        db.create_collection("col-a", "化学", None).expect("create");

        // collection_documents 的 document_id 外键要求文档真实存在,先造一条。
        let hash = sha256_hex(b"membership doc");
        db.upsert_document_from_upload(&upload_with_hash("up-membership", &hash))
            .expect("seed document");

        db.add_documents_to_collection("col-a", &[hash.clone()])
            .expect("add");
        // 幂等:重复加入不报错、不重复计数。
        db.add_documents_to_collection("col-a", &[hash.clone()])
            .expect("add again");
        let after_add = db.get_collection("col-a").expect("get").expect("found");
        assert_eq!(after_add.document_count, 1);

        assert!(db
            .remove_document_from_collection("col-a", &hash)
            .expect("remove"));
        let after_remove = db.get_collection("col-a").expect("get").expect("found");
        assert_eq!(after_remove.document_count, 0);
    }
}
