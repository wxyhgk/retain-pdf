//! 主对话、副对话：取或建主对话幂等、只有一个开着的主对话、副对话只能挂在主对话上、结束回填卡片、只追加和幂等号、
//! 分页、按书列问过的地方、删书置空、删对话不删记忆。

use super::*;
use crate::db::documents::sha256_hex;
use crate::db::{AskMemoryCreated, NewAskMemory};
use crate::models::domain::UploadRecord;

fn fixture(name: &str) -> (std::path::PathBuf, Db) {
    let root = std::env::temp_dir().join(format!("retain-askconv-{name}-{:016x}", fastrand::u64(..)));
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

fn delete_book(db: &Db, document_id: &str) {
    db.connect()
        .unwrap()
        .execute(
            "DELETE FROM library_items WHERE item_id = (SELECT item_id FROM item_files WHERE file_id = ?1)",
            rusqlite::params![document_id],
        )
        .unwrap();
}

fn ask(text: &str, document_id: Option<&str>, page: Option<u32>, client: Option<&str>) -> NewAskConversationMessage {
    NewAskConversationMessage {
        role: "user".into(),
        text: text.into(),
        agent_id: Some("retainpdf".into()),
        document_id: document_id.map(str::to_string),
        job_id: document_id.map(|_| "job-1".to_string()),
        version_id: document_id.map(|_| "tv-1".to_string()),
        pane: page.map(|_| "translated".to_string()),
        page,
        selection: page.map(|page| serde_json::json!({"page": page, "item_ids": ["p1-b2"], "selected_text": "选中的字"})),
        client_message_id: client.map(str::to_string),
        ..Default::default()
    }
}

fn answer(text: &str) -> NewAskConversationMessage {
    NewAskConversationMessage { role: "assistant".into(), text: text.into(), ..Default::default() }
}

fn appended(outcome: AskMessagesAppended) -> Vec<AskConversationMessageRecord> {
    match outcome {
        AskMessagesAppended::Appended(messages) => messages,
        _ => panic!("expected appended"),
    }
}

#[test]
fn main_conversation_is_ensured_once_and_archiving_makes_room_for_a_new_one() {
    let (root, db) = fixture("main");
    let first = db.ensure_main_ask_conversation().unwrap();
    assert_eq!((first.kind.as_str(), first.status.as_str(), first.message_count, first.last_seq), ("main", "open", 0, 0));
    assert_eq!(db.ensure_main_ask_conversation().unwrap().conversation_id, first.conversation_id);

    let archived = db
        .update_ask_conversation(&first.conversation_id, &AskConversationChanges { status: Some("archived"), ..Default::default() })
        .unwrap();
    assert!(matches!(archived, AskConversationUpdated::Updated(ref record) if record.status == "archived"));
    let second = db.ensure_main_ask_conversation().unwrap();
    assert_ne!(second.conversation_id, first.conversation_id);
    // 重新打开旧的：已经有一个开着的主对话
    let reopen = db
        .update_ask_conversation(&first.conversation_id, &AskConversationChanges { status: Some("open"), ..Default::default() })
        .unwrap();
    assert!(matches!(reopen, AskConversationUpdated::AnotherOpenMain));
    // 主对话没有 closed
    let closed = db
        .update_ask_conversation(&second.conversation_id, &AskConversationChanges { status: Some("closed"), ..Default::default() })
        .unwrap();
    assert!(matches!(closed, AskConversationUpdated::BadStatus));
    let mains = db.list_ask_conversations(&AskConversationFilter { kind: Some("main"), ..Default::default() }).unwrap();
    assert_eq!(mains.len(), 2);
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn messages_append_in_order_are_idempotent_and_page_backwards() {
    let (root, db) = fixture("append");
    let document = book(&db, "up-1");
    let main = db.ensure_main_ask_conversation().unwrap();
    let id = main.conversation_id.as_str();
    let turn = vec![ask("第一问", Some(&document), Some(2), Some("c-1")), answer("第一答")];
    let first = appended(db.append_ask_conversation_messages(id, &turn, 100).unwrap());
    assert_eq!(first.iter().map(|m| m.seq).collect::<Vec<_>>(), vec![1, 2]);
    assert_eq!(first[0].document_id.as_deref(), Some(document.as_str()));
    assert_eq!(first[0].selection.as_ref().unwrap()["item_ids"][0], "p1-b2");
    assert_eq!((first[0].version_id.as_deref(), first[0].page), (Some("tv-1"), Some(2)));
    // 网络重试：同一个幂等号回原来那条，不再插
    let retried = appended(db.append_ask_conversation_messages(id, &turn[..1], 100).unwrap());
    assert_eq!(retried[0].message_id, first[0].message_id);
    // 不在库里的书当没有书（删书和追加撞上）
    let ghost = appended(db.append_ask_conversation_messages(id, &[ask("第二问", Some("no-such-book"), None, None)], 100).unwrap());
    assert_eq!((ghost[0].seq, ghost[0].document_id.clone()), (3, None));
    assert!(matches!(db.append_ask_conversation_messages(id, &[answer("x"), answer("y")], 4).unwrap(), AskMessagesAppended::TooMany));

    let last_two = db.list_ask_conversation_messages(id, None, 2).unwrap();
    assert_eq!(last_two.iter().map(|m| m.seq).collect::<Vec<_>>(), vec![2, 3]);
    let before = db.list_ask_conversation_messages(id, Some(2), 10).unwrap();
    assert_eq!(before.iter().map(|m| m.seq).collect::<Vec<_>>(), vec![1]);
    assert_eq!(db.get_ask_conversation(id).unwrap().unwrap().last_seq, 3);

    let marks = db.list_document_ask_messages(&document, 100).unwrap();
    assert_eq!(marks.iter().map(|m| m.text.as_str()).collect::<Vec<_>>(), vec!["第一问"]);
    // 删书：消息留着、书置空
    delete_book(&db, &document);
    let after = db.list_ask_conversation_messages(id, None, 10).unwrap();
    assert_eq!((after.len(), after[0].document_id.clone(), after[0].page), (3, None, Some(2)));
    let _ = std::fs::remove_dir_all(root);
}

/// v46：一问带的另外几处出处按顺序存、读回来；没有的读出来是空数组（老消息、回答都是）；「问过的地方」也带上。
#[test]
fn extra_selections_round_trip_and_show_in_the_book_marks() {
    let (root, db) = fixture("extra-selections");
    let document = book(&db, "up-1");
    let main = db.ensure_main_ask_conversation().unwrap();
    let id = main.conversation_id.as_str();
    let mut question = ask("这三处是一回事吗", Some(&document), Some(2), Some("c-1"));
    question.extra_selections = vec![
        serde_json::json!({"page": 5, "item_ids": ["p5-b1"], "selected_text": "第二处"}),
        serde_json::json!({"page": 9, "item_ids": [], "selected_text": "第三处"}),
    ];
    let saved = appended(db.append_ask_conversation_messages(id, &[question, answer("是")], 100).unwrap());
    assert_eq!(saved[0].extra_selections.iter().map(|s| s["page"].as_u64().unwrap()).collect::<Vec<_>>(), vec![5, 9]);
    assert!(saved[1].extra_selections.is_empty());
    let raw: Option<String> = db
        .connect()
        .unwrap()
        .query_row("SELECT extra_selections_json FROM ask_conversation_messages WHERE message_id = ?1", [&saved[1].message_id], |row| row.get(0))
        .unwrap();
    assert_eq!(raw, None, "no extra places are stored as NULL");
    let marks = db.list_document_ask_messages(&document, 100).unwrap();
    assert_eq!(marks[0].extra_selections[1]["selected_text"], "第三处");
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn side_conversations_hang_on_main_and_close_with_a_summary_card() {
    let (root, db) = fixture("side");
    let main = db.ensure_main_ask_conversation().unwrap();
    let forked = appended(db.append_ask_conversation_messages(&main.conversation_id, &[ask("问", None, None, None), answer("答")], 100).unwrap());
    let new = NewAskSideConversation {
        parent_id: &main.conversation_id,
        forked_from_message_id: Some(&forked[1].message_id),
        title: "深挖",
        document_id: None,
    };
    let AskSideCreated::Created(side) = db.create_side_ask_conversation(&new).unwrap() else { panic!("side") };
    assert_eq!((side.kind.as_str(), side.parent_id.as_deref()), ("side", Some(main.conversation_id.as_str())));
    // 副对话里不能再开副对话；分叉的消息要在父对话里；书要在
    let nested = NewAskSideConversation { parent_id: &side.conversation_id, forked_from_message_id: None, title: "", document_id: None };
    assert!(matches!(db.create_side_ask_conversation(&nested).unwrap(), AskSideCreated::ParentNotMain));
    let stray = NewAskSideConversation { parent_id: &main.conversation_id, forked_from_message_id: Some("msg-x"), title: "", document_id: None };
    assert!(matches!(db.create_side_ask_conversation(&stray).unwrap(), AskSideCreated::ForkNotInParent));
    let bookless = NewAskSideConversation { parent_id: &main.conversation_id, forked_from_message_id: None, title: "", document_id: Some("nope") };
    assert!(matches!(db.create_side_ask_conversation(&bookless).unwrap(), AskSideCreated::DocumentMissing));
    let orphan = NewAskSideConversation { parent_id: "conv-x", forked_from_message_id: None, title: "", document_id: None };
    assert!(matches!(db.create_side_ask_conversation(&orphan).unwrap(), AskSideCreated::ParentMissing));
    assert!(matches!(db.close_side_ask_conversation(&main.conversation_id, None).unwrap(), AskSideClosed::NotSide));

    appended(db.append_ask_conversation_messages(&side.conversation_id, &[ask("细问", None, None, None)], 100).unwrap());
    let AskSideClosed::Closed(closed, Some(card)) = db.close_side_ask_conversation(&side.conversation_id, Some("结论是 X")).unwrap() else {
        panic!("closed with card")
    };
    assert_eq!((closed.status.as_str(), closed.summary.as_deref()), ("closed", Some("结论是 X")));
    assert!(closed.closed_at.is_some());
    assert_eq!((card.role.as_str(), card.seq, card.side_conversation_id.as_deref()), ("side_summary", 3, Some(side.conversation_id.as_str())));
    // 结束了不能再追加；再开以后可以
    assert!(matches!(db.append_ask_conversation_messages(&side.conversation_id, &[answer("x")], 100).unwrap(), AskMessagesAppended::NotOpen));
    let reopened = db
        .update_ask_conversation(&side.conversation_id, &AskConversationChanges { status: Some("open"), title: Some("新标题") })
        .unwrap();
    assert!(matches!(reopened, AskConversationUpdated::Updated(ref record) if record.closed_at.is_none() && record.title == "新标题"));

    let sides = db.list_ask_conversations(&AskConversationFilter { parent_id: Some(&main.conversation_id), ..Default::default() }).unwrap();
    assert_eq!(sides.len(), 1);
    // 删副对话：卡片留着、指向置空
    assert!(matches!(db.delete_ask_conversation(&side.conversation_id).unwrap(), AskConversationDeleted::Deleted { .. }));
    let main_messages = db.list_ask_conversation_messages(&main.conversation_id, None, 10).unwrap();
    assert_eq!((main_messages.len(), main_messages[2].side_conversation_id.clone()), (3, None));
    assert!(matches!(db.delete_ask_conversation(&side.conversation_id).unwrap(), AskConversationDeleted::NotFound));
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn deleting_a_conversation_keeps_memories_and_appending_links_them() {
    let (root, db) = fixture("memlink");
    let main = db.ensure_main_ask_conversation().unwrap();
    let new = NewAskMemory {
        scope: "user".into(),
        category: "preference".into(),
        text: "用户喜欢先看结论".into(),
        origin: "agent".into(),
        source_conversation_id: Some(main.conversation_id.clone()),
        ..Default::default()
    };
    let AskMemoryCreated::Created(memory) = db.create_ask_memory(&new, 100).unwrap() else { panic!("created") };
    let mut reply = answer("好的，记住了");
    reply.memory_ids = vec![memory.memory_id.clone(), "mem-missing".into()];
    let messages = appended(db.append_ask_conversation_messages(&main.conversation_id, &[ask("记一下", None, None, None), reply], 100).unwrap());
    let linked = db.get_ask_memory(&memory.memory_id).unwrap().unwrap();
    assert_eq!(linked.source_message_id.as_deref(), Some(messages[1].message_id.as_str()));

    // 开着的主对话不删；归档以后才能删
    assert!(matches!(db.delete_ask_conversation(&main.conversation_id).unwrap(), AskConversationDeleted::MainStillOpen));
    db.update_ask_conversation(&main.conversation_id, &AskConversationChanges { status: Some("archived"), ..Default::default() })
        .unwrap();
    assert!(matches!(db.delete_ask_conversation(&main.conversation_id).unwrap(), AskConversationDeleted::Deleted { .. }));
    let kept = db.get_ask_memory(&memory.memory_id).unwrap().unwrap();
    assert_eq!((kept.status.as_str(), kept.source_conversation_id.clone(), kept.source_message_id.clone()), ("active", None, None));
    let _ = std::fs::remove_dir_all(root);
}

/// 2026-11-27 用户定主对话按书分：每本书各有一个开着的主对话，和全局那条（没有书的）互不影响；归档、重新打开按书算；
/// 书不存在是 None；删书前先把这本书开着的主对话归档（不然书号置空后撞全局那条的唯一索引、书删不掉）。
#[test]
fn each_book_has_its_own_open_main_conversation() {
    let (root, db) = fixture("main-per-book");
    let (a, b) = (book(&db, "up-a"), book(&db, "up-b"));
    let global = db.ensure_main_ask_conversation().unwrap();
    let main_a = db.ensure_book_main_ask_conversation(&a).unwrap().unwrap();
    let main_b = db.ensure_book_main_ask_conversation(&b).unwrap().unwrap();
    assert_eq!(main_a.document_id.as_deref(), Some(a.as_str()));
    assert!(global.document_id.is_none());
    assert_ne!(main_a.conversation_id, main_b.conversation_id);
    assert_ne!(main_a.conversation_id, global.conversation_id);
    assert_eq!(db.ensure_book_main_ask_conversation(&a).unwrap().unwrap().conversation_id, main_a.conversation_id);
    assert_eq!(db.ensure_main_ask_conversation().unwrap().conversation_id, global.conversation_id);
    assert!(db.ensure_book_main_ask_conversation("doc-missing").unwrap().is_none());

    // 归档这本书的，再要就是新的一条；旧的不能重新打开（这本书已经有开着的），别的书不受影响
    let archive = AskConversationChanges { status: Some("archived"), ..Default::default() };
    assert!(matches!(db.update_ask_conversation(&main_a.conversation_id, &archive).unwrap(), AskConversationUpdated::Updated(_)));
    let next_a = db.ensure_book_main_ask_conversation(&a).unwrap().unwrap();
    assert_ne!(next_a.conversation_id, main_a.conversation_id);
    let reopen = AskConversationChanges { status: Some("open"), ..Default::default() };
    assert!(matches!(db.update_ask_conversation(&main_a.conversation_id, &reopen).unwrap(), AskConversationUpdated::AnotherOpenMain));
    let only_a = db.list_ask_conversations(&AskConversationFilter { kind: Some("main"), document_id: Some(&a), ..Default::default() }).unwrap();
    let mut ids = only_a.iter().map(|c| c.conversation_id.as_str()).collect::<Vec<_>>();
    ids.sort_unstable();
    let mut expected = [next_a.conversation_id.as_str(), main_a.conversation_id.as_str()];
    expected.sort_unstable();
    assert_eq!(ids, expected, "按书筛只有这本书的（同一秒内的先后不定）");

    // 删书：开着的主对话先归档、书号置空，删得掉；全局那条照旧开着
    delete_book(&db, &b);
    let gone = db.get_ask_conversation(&main_b.conversation_id).unwrap().unwrap();
    assert_eq!((gone.status.as_str(), gone.document_id.as_deref()), ("archived", None));
    assert_eq!(db.get_ask_conversation(&global.conversation_id).unwrap().unwrap().status, "open");
    let _ = std::fs::remove_dir_all(root);
}

/// v45 把以前的全局主对话按书拆开（用户定「按书拆开」）：带书的消息挪到那本书的主对话里、按原来的顺序重新编号；
/// 没书的留在原来那条；副对话跟着分叉的那条消息走，它的结论卡片跟着它；记忆的出处跟着消息；拆过的对话的压缩摘要作废。
#[test]
fn v45_splits_the_old_global_main_conversation_by_book() {
    let (root, db) = fixture("main-split");
    let (a, b) = (book(&db, "up-a"), book(&db, "up-b"));
    let old = db.ensure_main_ask_conversation().unwrap();
    let id = old.conversation_id.clone();
    let turns = [
        (ask("A 第一问", Some(&a), Some(1), None), answer("A 第一答")),
        (ask("B 第一问", Some(&b), Some(2), None), answer("B 第一答")),
        (ask("没书的问", None, None, None), answer("没书的答")),
        (ask("A 第二问", Some(&a), Some(3), None), answer("A 第二答")),
    ];
    let mut messages = Vec::new();
    for (question, reply) in turns {
        // 旧数据里回答也带着书（前端追加一轮时问和答都带出处）
        let reply = NewAskConversationMessage { document_id: question.document_id.clone(), ..reply };
        messages.extend(appended(db.append_ask_conversation_messages(&id, &[question, reply], 100).unwrap()));
    }
    let side = match db
        .create_side_ask_conversation(&NewAskSideConversation {
            parent_id: &id,
            forked_from_message_id: Some(&messages[6].message_id),
            title: "A 的副对话",
            document_id: None,
        })
        .unwrap()
    {
        AskSideCreated::Created(side) => side,
        _ => panic!("side"),
    };
    let AskSideClosed::Closed(_, Some(card)) = db.close_side_ask_conversation(&side.conversation_id, Some("A 的结论")).unwrap() else {
        panic!("closed")
    };
    let memory = NewAskMemory {
        scope: "user".into(),
        category: "preference".into(),
        text: "喜欢先看结论".into(),
        origin: "agent".into(),
        source_conversation_id: Some(id.clone()),
        source_message_id: Some(messages[3].message_id.clone()),
        ..Default::default()
    };
    let AskMemoryCreated::Created(memory) = db.create_ask_memory(&memory, 100).unwrap() else { panic!("memory") };
    let conn = db.connect().unwrap();
    conn.execute(
        "INSERT INTO ask_compactions (compaction_id, conversation_id, covers_to_seq, summary, created_at) VALUES ('cmp-1', ?1, 4, '混着两本书', ?2)",
        rusqlite::params![id, now_iso()],
    )
    .unwrap();
    // 倒回 v44 的样子（索引按 kind、没有触发器）再跑 v45
    conn.execute_batch(
        "DROP TRIGGER ask_main_archive_before_document_delete;
         DROP INDEX idx_ask_conversations_one_open_main;
         DROP INDEX idx_ask_conversations_main_document;
         CREATE UNIQUE INDEX idx_ask_conversations_one_open_main ON ask_conversations(kind) WHERE kind = 'main' AND status = 'open';
         PRAGMA user_version = 44;",
    )
    .unwrap();
    drop(conn);
    let db = Db::new(root.join("db.sqlite"), root.join("data"));
    db.init().unwrap();

    let mains = db.list_ask_conversations(&AskConversationFilter { kind: Some("main"), ..Default::default() }).unwrap();
    assert_eq!(mains.len(), 3, "原来那条 + 两本书各一条");
    let main_of = |document_id: &str| mains.iter().find(|c| c.document_id.as_deref() == Some(document_id)).unwrap().clone();
    let (main_a, main_b) = (main_of(&a), main_of(&b));
    assert!(mains.iter().all(|c| c.status == "open"));
    let texts = |conversation_id: &str| {
        db.list_ask_conversation_messages(conversation_id, None, 100)
            .unwrap()
            .into_iter()
            .map(|m| (m.seq, m.text))
            .collect::<Vec<_>>()
    };
    assert_eq!(
        texts(&main_a.conversation_id),
        [(1, "A 第一问"), (2, "A 第一答"), (3, "A 第二问"), (4, "A 第二答"), (5, "A 的结论")]
            .map(|(seq, text)| (seq, text.to_string()))
    );
    assert_eq!(texts(&main_b.conversation_id), [(1, "B 第一问".to_string()), (2, "B 第一答".to_string())]);
    assert_eq!(texts(&id), [(5, "没书的问".to_string()), (6, "没书的答".to_string())]);
    assert_eq!(db.get_ask_conversation_message(&card.message_id).unwrap().unwrap().conversation_id, main_a.conversation_id);
    assert_eq!(db.get_ask_conversation(&side.conversation_id).unwrap().unwrap().parent_id.as_deref(), Some(main_a.conversation_id.as_str()));
    assert_eq!(db.get_ask_memory(&memory.memory_id).unwrap().unwrap().source_conversation_id.as_deref(), Some(main_b.conversation_id.as_str()));
    let superseded: Option<String> = db
        .connect()
        .unwrap()
        .query_row("SELECT superseded_at FROM ask_compactions WHERE compaction_id = 'cmp-1'", [], |row| row.get(0))
        .unwrap();
    assert!(superseded.is_some(), "混着几本书的压缩摘要要作废");
    // 拆完以后照旧按书取到同一条，往里追加接着编号
    assert_eq!(db.ensure_book_main_ask_conversation(&a).unwrap().unwrap().conversation_id, main_a.conversation_id);
    let next = appended(db.append_ask_conversation_messages(&main_a.conversation_id, &[ask("A 第三问", Some(&a), None, None)], 100).unwrap());
    assert_eq!(next[0].seq, 6);
    let _ = std::fs::remove_dir_all(root);
}
