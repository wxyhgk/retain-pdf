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
    assert!(db.delete_ask_conversation(&side.conversation_id).unwrap());
    let main_messages = db.list_ask_conversation_messages(&main.conversation_id, None, 10).unwrap();
    assert_eq!((main_messages.len(), main_messages[2].side_conversation_id.clone()), (3, None));
    assert!(!db.delete_ask_conversation(&side.conversation_id).unwrap());
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

    assert!(db.delete_ask_conversation(&main.conversation_id).unwrap());
    let kept = db.get_ask_memory(&memory.memory_id).unwrap().unwrap();
    assert_eq!((kept.status.as_str(), kept.source_conversation_id.clone(), kept.source_message_id.clone()), ("active", None, None));
    let _ = std::fs::remove_dir_all(root);
}
