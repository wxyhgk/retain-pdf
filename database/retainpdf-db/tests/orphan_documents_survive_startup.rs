//! 启动回填不再删「没有上传记录的书」（2026-11-26）：同步时书（document 实体）先到、上传（upload 实体）还在等文件，
//! 这时重启以前会把书连同本机的问答、译文版本删掉，并把删除记进 sync_dirty 发给别的设备。
use retainpdf_db::db::documents::sha256_hex;
use retainpdf_db::db::sync::SyncEntityUpdate;
use retainpdf_db::db::{AskAnchorRecord, AskMessageRecord, AskThreadCreated, Db, NewAskThread};
use retainpdf_db::models::domain::{now_iso, UploadRecord};

fn db_at(name: &str) -> Db {
    let root = std::env::temp_dir().join(format!("retainpdf-orphan-{name}-{:016x}", fastrand::u64(..)));
    let db = Db::new(root.join("db.sqlite"), root.join("data"));
    db.init().unwrap();
    db
}

#[test]
fn a_synced_book_waiting_for_its_upload_survives_a_restart() {
    // 设备 A：上传一本书，读出 document 实体
    let a = db_at("a");
    let upload = UploadRecord {
        upload_id: "up-1".into(),
        filename: "book.pdf".into(),
        stored_path: "uploads/up-1/book.pdf".into(),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: sha256_hex(b"book"),
    };
    a.save_upload_with_document(&upload).unwrap();
    let id = upload.content_hash.clone();
    let rows = a.sync_read_entity("document", &id).unwrap().expect("document rows");

    // 设备 B：只收到 document 实体（upload 实体在等文件）
    let b = db_at("b");
    b.sync_apply_entity(
        &SyncEntityUpdate {
            kind: "document",
            key: &id,
            clock: "0000000000001-0000-dev-a",
            deleted: false,
            digest: "d",
            base_json: &serde_json::to_string(&rows).unwrap(),
            clocks_json: "{}",
            files: &[],
        },
        Some(&rows),
    )
    .unwrap();
    assert!(b.get_document(&id).is_ok());

    // B 上的本机数据：一次提问、一个译文版本
    let anchor = AskAnchorRecord {
        pane: "source".into(),
        page: 1,
        item_id: None,
        selection: String::new(),
        source_text: String::new(),
        translated_text: String::new(),
        section: String::new(),
        point: None,
    };
    let messages = vec![AskMessageRecord { role: "user".into(), text: "问".into(), thought: None, usage: None }];
    let created = b
        .create_ask_thread(
            &NewAskThread { document_id: &id, agent_id: "retainpdf", session_id: None, title: "问", anchor: &anchor, messages: &messages },
            500,
        )
        .unwrap();
    assert!(matches!(created, AskThreadCreated::Created(_)));
    b.create_translation_version(&id, None, "translate").unwrap();

    // 重启（rust_api / jobsd 启动都会 init）
    b.init().unwrap();

    assert!(b.get_document(&id).is_ok(), "the book is kept");
    assert_eq!(b.count_ask_threads(&id).unwrap(), 1, "local ask threads are kept");
    assert!(
        !b.sync_dirty(100).unwrap().into_iter().any(|d| d.kind == "document" && d.key == id),
        "no deletion is queued for other devices"
    );
}
