//! 记忆：记、不重记一模一样的、替代旧的、上限、全文检索（长词 FTS5、短词 LIKE）、改、删和撤销恢复、删书跟着删。

use super::*;
use crate::db::documents::sha256_hex;
use crate::models::domain::UploadRecord;

fn fixture(name: &str) -> (std::path::PathBuf, Db) {
    let root = std::env::temp_dir().join(format!("retain-askmem-{name}-{:016x}", fastrand::u64(..)));
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

fn memory(scope: &str, document_id: Option<&str>, text: &str) -> NewAskMemory {
    NewAskMemory {
        scope: scope.into(),
        document_id: document_id.map(str::to_string),
        category: "other".into(),
        text: text.into(),
        origin: "agent".into(),
        agent_id: Some("retainpdf".into()),
        ..Default::default()
    }
}

fn created(outcome: AskMemoryCreated) -> AskMemoryRecord {
    match outcome {
        AskMemoryCreated::Created(record) => record,
        _ => panic!("expected created"),
    }
}

fn texts(records: &[AskMemoryRecord]) -> Vec<&str> {
    records.iter().map(|record| record.text.as_str()).collect()
}

#[test]
fn memories_are_deduplicated_replaced_and_limited_per_layer() {
    let (root, db) = fixture("create");
    let document = book(&db, "u1");
    let first = created(db.create_ask_memory(&memory("user", None, "用户 喜欢 先看结论"), 3).unwrap());
    // 去掉空白后一样：回原来那条
    assert!(matches!(db.create_ask_memory(&memory("user", None, "用户喜欢先看结论"), 3).unwrap(),
        AskMemoryCreated::Duplicate(ref record) if record.memory_id == first.memory_id));
    // 书层同样的字不算重复（不同层）
    created(db.create_ask_memory(&memory("book", Some(&document), "用户喜欢先看结论"), 3).unwrap());
    assert!(matches!(db.create_ask_memory(&memory("book", Some("nope"), "x"), 3).unwrap(), AskMemoryCreated::DocumentMissing));

    let mut newer = memory("user", None, "用户喜欢先看推导");
    newer.replaces = Some(first.memory_id.clone());
    let second = created(db.create_ask_memory(&newer, 3).unwrap());
    let old = db.get_ask_memory(&first.memory_id).unwrap().unwrap();
    assert_eq!((old.status.as_str(), old.superseded_by.as_deref()), ("superseded", Some(second.memory_id.as_str())));
    newer.replaces = Some("mem-missing".into());
    newer.text = "别的".into();
    assert!(matches!(db.create_ask_memory(&newer, 3).unwrap(), AskMemoryCreated::ReplacesMissing));

    created(db.create_ask_memory(&memory("user", None, "第二条"), 3).unwrap());
    created(db.create_ask_memory(&memory("user", None, "第三条"), 3).unwrap());
    assert!(matches!(db.create_ask_memory(&memory("user", None, "第四条"), 3).unwrap(), AskMemoryCreated::LimitReached));
    // 替代一条 active 的不占新名额
    let mut swap = memory("user", None, "第三条改过");
    swap.replaces = Some(second.memory_id.clone());
    created(db.create_ask_memory(&swap, 3).unwrap());
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn memories_are_listed_by_layer_and_searched_with_fts_or_like() {
    let (root, db) = fixture("search");
    let document = book(&db, "u1");
    let other = book(&db, "u2");
    created(db.create_ask_memory(&memory("user", None, "用户是化学专业的研究生"), 50).unwrap());
    created(db.create_ask_memory(&memory("book", Some(&document), "Hamiltonian 定译为哈密顿量"), 50).unwrap());
    created(db.create_ask_memory(&memory("book", Some(&other), "读到第 12 页"), 50).unwrap());

    let all = db.list_ask_memories(&AskMemoryFilter { limit: 10, ..Default::default() }).unwrap();
    assert_eq!(all.len(), 3);
    let book_layer = db
        .list_ask_memories(&AskMemoryFilter { scope: Some("book"), document_id: Some(&document), limit: 10, ..Default::default() })
        .unwrap();
    assert_eq!(texts(&book_layer), vec!["Hamiltonian 定译为哈密顿量"]);
    // 长词走 FTS5（不分大小写），几个词都要在
    let hit = db.list_ask_memories(&AskMemoryFilter { query: Some("hamiltonian 哈密顿"), limit: 10, ..Default::default() }).unwrap();
    assert_eq!(texts(&hit), vec!["Hamiltonian 定译为哈密顿量"]);
    // 两个字的词退回 LIKE
    let short = db.list_ask_memories(&AskMemoryFilter { query: Some("化学"), limit: 10, ..Default::default() }).unwrap();
    assert_eq!(texts(&short), vec!["用户是化学专业的研究生"]);
    assert!(db.list_ask_memories(&AskMemoryFilter { query: Some("不存在的词"), limit: 10, ..Default::default() }).unwrap().is_empty());
    // 引号不会弄坏 MATCH
    db.list_ask_memories(&AskMemoryFilter { query: Some("\"Hamil\"ton"), limit: 10, ..Default::default() }).unwrap();

    // 删书：书层跟着删
    db.connect()
        .unwrap()
        .execute(
            "DELETE FROM library_items WHERE item_id = (SELECT item_id FROM item_files WHERE file_id = ?1)",
            rusqlite::params![document],
        )
        .unwrap();
    let left = db.list_ask_memories(&AskMemoryFilter { limit: 10, ..Default::default() }).unwrap();
    assert_eq!(left.len(), 2);
    assert!(db.list_ask_memories(&AskMemoryFilter { query: Some("hamiltonian"), limit: 10, ..Default::default() }).unwrap().is_empty());
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn editing_and_deleting_keep_the_row_and_undo_restores_the_replaced_one() {
    let (root, db) = fixture("delete");
    let old = created(db.create_ask_memory(&memory("user", None, "回答用英文"), 50).unwrap());
    let mut newer = memory("user", None, "回答用中文");
    newer.replaces = Some(old.memory_id.clone());
    let new = created(db.create_ask_memory(&newer, 50).unwrap());

    let edited = db.update_ask_memory(&new.memory_id, Some("回答用简体中文"), Some("style")).unwrap().unwrap();
    assert_eq!((edited.text.as_str(), edited.category.as_str()), ("回答用简体中文", "style"));
    let found = db.list_ask_memories(&AskMemoryFilter { query: Some("简体中文"), limit: 10, ..Default::default() }).unwrap();
    assert_eq!(found.len(), 1);

    // 撤销新的：标 deleted，旧的回到 active
    let deleted = db.delete_ask_memory(&new.memory_id).unwrap().unwrap();
    assert_eq!(deleted.status, "deleted");
    assert!(deleted.deleted_at.is_some());
    let restored = db.get_ask_memory(&old.memory_id).unwrap().unwrap();
    assert_eq!((restored.status.as_str(), restored.superseded_by.clone()), ("active", None));
    // 删了的不能改；列表默认看不到，按状态要得到
    assert!(db.update_ask_memory(&new.memory_id, Some("x"), None).unwrap().is_none());
    let active = db.list_ask_memories(&AskMemoryFilter { limit: 10, ..Default::default() }).unwrap();
    assert_eq!(texts(&active), vec!["回答用英文"]);
    let gone = db.list_ask_memories(&AskMemoryFilter { statuses: vec!["deleted"], limit: 10, ..Default::default() }).unwrap();
    assert_eq!(gone.len(), 1);
    assert!(db.delete_ask_memory("mem-missing").unwrap().is_none());
    assert_eq!(db.delete_ask_memory(&new.memory_id).unwrap().unwrap().status, "deleted");
    let _ = std::fs::remove_dir_all(root);
}
