//! 自动命名「书名还是默认值」的判断：只看 title_source / title_locked。

use std::path::PathBuf;

use super::*;
use crate::db::documents::sha256_hex;
use crate::models::domain::UploadRecord;

struct Fixture {
    root: PathBuf,
    db: Db,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retain-title-state-{}", fastrand::u64(..)));
        let db = Db::new(root.join("db.sqlite"), root.join("data"));
        db.init().unwrap();
        Self { root, db }
    }

    fn upload(&self, upload_id: &str, filename: &str, bytes: &[u8]) -> String {
        let upload = UploadRecord {
            upload_id: upload_id.to_string(),
            filename: filename.to_string(),
            stored_path: format!("uploads/{upload_id}/{filename}"),
            bytes: 10,
            page_count: 3,
            uploaded_at: now_iso(),
            developer_mode: false,
            content_hash: sha256_hex(bytes),
        };
        self.db.save_upload(&upload).unwrap();
        self.db.upsert_document_from_upload(&upload).unwrap();
        upload.content_hash
    }

    fn suggest(&self, document_id: &str, title: &str) -> String {
        self.db
            .insert_document_metadata_suggestion(
                &format!("meta-{title}"),
                document_id,
                None,
                "sha",
                r#"["title"]"#,
                "[]",
                title,
                "ocr_structure",
                false,
            )
            .unwrap()
            .suggestion_id
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn reuploading_under_another_name_still_counts_as_the_default_title() {
    let fx = Fixture::new();
    let document_id = fx.upload("up-a", "a.pdf", b"same bytes");
    fx.upload("up-b", "b.pdf", b"same bytes");
    let suggestion = fx.suggest(&document_id, "Real Title");
    let result = fx
        .db
        .apply_document_metadata_suggestion(&document_id, &suggestion, None)
        .unwrap();
    let ApplyDocumentMetadataSuggestionResult::Applied { document, .. } = result else {
        panic!("re-upload under another name must not look like a user rename: {result:?}");
    };
    assert_eq!(document.title, "Real Title");
    assert_eq!(document.title_source, "ocr");
}

#[test]
fn a_user_title_is_still_protected() {
    let fx = Fixture::new();
    let document_id = fx.upload("up-a", "a.pdf", b"user bytes");
    fx.db.update_document_fields(&document_id, Some("Mine"), None).unwrap();
    let suggestion = fx.suggest(&document_id, "Real Title");
    let result = fx
        .db
        .apply_document_metadata_suggestion(&document_id, &suggestion, None)
        .unwrap();
    assert!(matches!(result, ApplyDocumentMetadataSuggestionResult::TitleChanged(_)), "{result:?}");
}

/// 有 title_state 表之前（v12 以前）手改的书名没有来源记录，读出来是 filename。升到 v28 时
/// 一次性补成 user + 锁定，免得只看来源以后被自动命名盖掉；书名就是默认值的不补。
#[test]
fn upgrading_marks_legacy_renamed_titles_as_user_titles() {
    // 建一个停在 v27 的库，按那时的表写两本书（都没有来源记录），再升到最新。
    let root = std::env::temp_dir().join(format!("retain-title-state-{}", fastrand::u64(..)));
    std::fs::create_dir_all(&root).unwrap();
    let (renamed, untouched) = ("renamed-doc".to_string(), "untouched-doc".to_string());
    {
        let conn = rusqlite::Connection::open(root.join("db.sqlite")).unwrap();
        crate::db::schema::create_at_version(&conn, 27).unwrap();
        // 没有上传记录的书开库时会当孤儿清掉，各配一条上传。
        conn.execute_batch(
            "INSERT INTO documents (document_id, title, source_filename, added_at, updated_at) VALUES
                 ('renamed-doc', 'Hand Picked Name', 'scan_0001.pdf', 't', 't'),
                 ('untouched-doc', 'untouched', 'untouched.PDF', 't', 't');
             INSERT INTO uploads (upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash)
             VALUES ('up-renamed', 'scan_0001.pdf', 'uploads/a.pdf', 1, 1, 't', 0, 'renamed-doc'),
                    ('up-untouched', 'untouched.PDF', 'uploads/b.pdf', 1, 1, 't', 0, 'untouched-doc');",
        )
        .unwrap();
    }
    let reopened = Db::new(root.join("db.sqlite"), root.join("data"));
    reopened.init().unwrap();

    let renamed = reopened.get_document(&renamed).unwrap();
    assert_eq!((renamed.title_source.as_str(), renamed.title_locked), ("user", true));
    let untouched = reopened.get_document(&untouched).unwrap();
    assert_eq!((untouched.title_source.as_str(), untouched.title_locked), ("filename", false));
    let rows: i64 = reopened
        .connect()
        .unwrap()
        .query_row("SELECT COUNT(*) FROM item_references WHERE title_source = 'user'", [], |row| row.get(0))
        .unwrap();
    assert_eq!(rows, 1, "only the renamed title is marked as the user's");
}
