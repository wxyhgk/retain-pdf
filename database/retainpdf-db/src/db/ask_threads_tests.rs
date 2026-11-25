//! 问答记录：建（带开头几条问答）、列、读、整份换问答、清会话编号、上限、只在自己的书上、删书级联。

use super::*;
use crate::db::documents::sha256_hex;
use crate::models::domain::UploadRecord;

fn fixture(name: &str) -> (std::path::PathBuf, Db) {
    let root = std::env::temp_dir().join(format!("retain-ask-{name}-{:016x}", fastrand::u64(..)));
    let db = Db::new(root.join("db.sqlite"), root.join("data"));
    db.init().unwrap();
    (root, db)
}

fn book(db: &Db, upload_id: &str) -> String {
    let upload = UploadRecord {
        upload_id: upload_id.to_string(),
        filename: format!("{upload_id}.pdf"),
        stored_path: format!("uploads/{upload_id}/{upload_id}.pdf"),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: sha256_hex(upload_id.as_bytes()),
    };
    db.save_upload_with_document(&upload).unwrap();
    upload.content_hash
}

fn anchor(page: u32) -> AskAnchorRecord {
    AskAnchorRecord {
        pane: "source".to_string(),
        page,
        item_id: Some("p1-b3".to_string()),
        selection: "选中的字".to_string(),
        source_text: "原文".to_string(),
        translated_text: "译文".to_string(),
        section: "第一章".to_string(),
        point: Some(AskPoint { x: 0.25, y: 0.5 }),
    }
}

fn message(role: &str, text: &str) -> AskMessageRecord {
    AskMessageRecord { role: role.to_string(), text: text.to_string(), thought: None, usage: None }
}

fn create(db: &Db, document_id: &str, page: u32, messages: &[AskMessageRecord], max: i64) -> AskThreadCreated {
    let anchor = anchor(page);
    db.create_ask_thread(
        &NewAskThread {
            document_id,
            agent_id: "retainpdf",
            session_id: Some("sess-1"),
            title: "这是什么",
            anchor: &anchor,
            messages,
        },
        max,
    )
    .unwrap()
}

fn created(result: AskThreadCreated) -> AskThreadRecord {
    match result {
        AskThreadCreated::Created(record) => record,
        AskThreadCreated::LimitReached => panic!("limit reached"),
    }
}

#[test]
fn threads_are_created_listed_updated_and_deleted() {
    let (root, db) = fixture("crud");
    let document_id = book(&db, "u1");
    let usage = serde_json::json!({"input_tokens": 10, "output_tokens": 3, "model": "m"});
    let first = vec![
        message("user", "这是什么"),
        AskMessageRecord { role: "assistant".into(), text: "是 X".into(), thought: Some("想了想".into()), usage: Some(usage.clone()) },
    ];
    let thread = created(create(&db, &document_id, 2, &first, 10));
    assert!(thread.thread_id.starts_with("ask-"), "{}", thread.thread_id);
    assert_eq!((thread.message_count, thread.anchor.clone(), thread.session_id.as_deref()), (2, anchor(2), Some("sess-1")));
    assert_eq!(db.ask_thread_messages(&thread.thread_id).unwrap(), first);

    // 没有位置、没有块的锚点也能存
    let bare = AskAnchorRecord { item_id: None, point: None, selection: String::new(), ..anchor(1) };
    let other = match db
        .create_ask_thread(
            &NewAskThread { document_id: &document_id, agent_id: "claude-code", session_id: None, title: "", anchor: &bare, messages: &[] },
            10,
        )
        .unwrap()
    {
        AskThreadCreated::Created(record) => record,
        AskThreadCreated::LimitReached => panic!(),
    };
    assert_eq!((other.anchor.clone(), other.message_count, other.session_id.clone()), (bare, 0, None));
    assert_eq!(db.count_ask_threads(&document_id).unwrap(), 2);

    // 整份换问答、清会话编号；最近改过的排前面
    let more = vec![message("user", "再问"), message("assistant", "再答"), message("user", "三问")];
    let changes = AskThreadChanges { agent_id: None, session_id: Some(None), messages: Some((&more, "再问")) };
    let updated = db.update_ask_thread(&document_id, &thread.thread_id, &changes).unwrap().unwrap();
    assert_eq!((updated.message_count, updated.title.as_str(), updated.session_id.clone()), (3, "再问", None));
    assert_eq!(db.ask_thread_messages(&thread.thread_id).unwrap(), more);
    let listed: Vec<String> = db.list_ask_threads(&document_id).unwrap().into_iter().map(|t| t.thread_id).collect();
    assert_eq!(listed.len(), 2);
    assert!(listed.contains(&thread.thread_id) && listed.contains(&other.thread_id));

    // 别的书上读不到、改不了、删不掉
    let elsewhere = book(&db, "u2");
    assert!(db.get_ask_thread(&elsewhere, &thread.thread_id).unwrap().is_none());
    assert!(db.update_ask_thread(&elsewhere, &thread.thread_id, &AskThreadChanges::default()).unwrap().is_none());
    assert!(!db.delete_ask_thread(&elsewhere, &thread.thread_id).unwrap());

    assert!(db.delete_ask_thread(&document_id, &other.thread_id).unwrap());
    assert!(!db.delete_ask_thread(&document_id, &other.thread_id).unwrap());
    assert_eq!(db.list_ask_threads(&document_id).unwrap().len(), 1);
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn a_book_holds_at_most_max_threads_and_missing_books_are_refused() {
    let (root, db) = fixture("limit");
    let document_id = book(&db, "u1");
    created(create(&db, &document_id, 1, &[], 2));
    created(create(&db, &document_id, 1, &[], 2));
    assert!(matches!(create(&db, &document_id, 1, &[], 2), AskThreadCreated::LimitReached));
    let anchor = anchor(1);
    let missing = db.create_ask_thread(
        &NewAskThread { document_id: "no-such-book", agent_id: "retainpdf", session_id: None, title: "", anchor: &anchor, messages: &[] },
        10,
    );
    assert!(missing.is_err());
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn deleting_the_book_deletes_its_threads_and_messages() {
    let (root, db) = fixture("cascade");
    let document_id = book(&db, "u1");
    let thread = created(create(&db, &document_id, 1, &[message("user", "q"), message("assistant", "a")], 10));
    let conn = db.connect().unwrap();
    conn.execute(
        "DELETE FROM library_items WHERE item_id = (SELECT item_id FROM item_files WHERE file_id = ?1)",
        rusqlite::params![document_id],
    )
    .unwrap();
    let left: (i64, i64) = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM ask_threads), (SELECT COUNT(*) FROM ask_messages WHERE thread_id = ?1)",
            rusqlite::params![thread.thread_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(left, (0, 0));
    std::fs::remove_dir_all(root).ok();
}
