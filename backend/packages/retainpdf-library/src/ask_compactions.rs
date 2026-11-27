//! 阅读页提问第二期（2026-11-26）：主对话太长时的压缩、副对话结束时由后端生成结论。
//!
//! 摘要都由后端用用户设置里那条模型生成：调用方（路由）给一个 [`AskSummarizer`]，它把「哪条模型 + 要压的那段」交给
//! ACP 桥那边的 `summarize` 子命令（providers 包 `acp/summarize.rs`）。书库这边只管挑哪些消息、拼请求、存结果。
//!
//! 压缩：
//! - 上一份摘要之后的消息超过 [`COMPACTION_DUE_CHARS`] 字就算该压了（追加消息的返回带 `compaction_due`）；
//! - 一次压「上一份摘要 + 它之后、最近 [`KEEP_RECENT_MESSAGES`] 条之前的消息」，新摘要替代 `seq <= covers_to_seq`；
//!   最近几条原样留着，开新会话时照旧当真的前几轮交给 agent；
//! - 原始消息一条不删，前端在压缩点画「之前的已压缩，点开看原文」。
//!
//! 方案见 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md 第 4、5 节。
use std::collections::HashMap;

use retainpdf_api_base::error::AppError;
use retainpdf_data::db::{AskCompactionInserted, AskCompactionRecord, AskConversationMessageRecord, NewAskCompaction};

use crate::ask_views::{AskCompactionListView, AskModelConnectionInput, CreateAskCompactionInput, CreateAskCompactionView};
use crate::LibraryDeps;

/// 上一份摘要之后的消息超过这么多字，就该压了。
pub(crate) const COMPACTION_DUE_CHARS: i64 = 40_000;
/// 压缩时最近这么多条（6 轮）原样留着不压。
pub(crate) const KEEP_RECENT_MESSAGES: i64 = 12;
const DEFAULT_SUMMARY_CHARS: u32 = 2_000;
const MIN_SUMMARY_CHARS: u32 = 100;
const MAX_SUMMARY_CHARS: u32 = 8_000;
/// 副对话结论卡片的字数上限（越短越好）。
const SIDE_SUMMARY_CHARS: u32 = 600;
/// 一次最多拿多少条去压（主对话本来就按阈值触发，正常远到不了）。
const MAX_MESSAGES_PER_SUMMARY: u32 = 2_000;

/// 生成摘要：用 `connection` 这条模型，把 `request`（summarize 子命令的 stdin）压成一段文字。
pub type AskSummarizer<'a> = dyn Fn(&AskModelConnectionInput, &serde_json::Value) -> Result<String, AppError> + 'a;

fn not_found(conversation_id: &str) -> AppError {
    AppError::not_found(format!("ask conversation not found: {conversation_id}"))
}

/// 现在生效的那份摘要替代到第几条（没压过是 0）。
pub(crate) fn covered_seq(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<i64, AppError> {
    Ok(deps.db.latest_ask_compaction(conversation_id)?.map(|record| record.covers_to_seq).unwrap_or(0))
}

/// 上一份摘要之后的消息是不是太长了。
pub(crate) fn compaction_due(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<bool, AppError> {
    let covered = covered_seq(deps, conversation_id)?;
    Ok(deps.db.ask_message_chars_after(conversation_id, covered)? > COMPACTION_DUE_CHARS)
}

/// 交给 summarize 子命令的消息：带书名和页，方便摘要里留出处（「（《书名》第 12 页）」）。
fn summary_messages(deps: &LibraryDeps<'_>, messages: &[AskConversationMessageRecord]) -> Vec<serde_json::Value> {
    let mut titles: HashMap<String, Option<String>> = HashMap::new();
    messages
        .iter()
        .map(|message| {
            let title = message.document_id.as_ref().and_then(|document_id| {
                titles
                    .entry(document_id.clone())
                    .or_insert_with(|| deps.db.get_document(document_id).ok().map(|record| record.title).filter(|title| !title.trim().is_empty()))
                    .clone()
            });
            serde_json::json!({
                "seq": message.seq,
                "role": message.role,
                "text": message.text,
                "document_title": title,
                "page": message.page,
            })
        })
        .collect()
}

fn checked_connection(connection: &AskModelConnectionInput) -> Result<(), AppError> {
    if connection.model.trim().is_empty() {
        return Err(AppError::bad_request("connection.model is required"));
    }
    if connection.credential_ref.trim().is_empty() {
        return Err(AppError::bad_request("connection.credential_ref is required"));
    }
    Ok(())
}

/// POST /ai/ask-conversations/:conversation_id/compactions。
pub fn create_ask_compaction_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &CreateAskCompactionInput,
    summarize: &AskSummarizer<'_>,
) -> Result<CreateAskCompactionView, AppError> {
    checked_connection(&payload.connection)?;
    let max_chars = payload.max_chars.unwrap_or(DEFAULT_SUMMARY_CHARS);
    if !(MIN_SUMMARY_CHARS..=MAX_SUMMARY_CHARS).contains(&max_chars) {
        return Err(AppError::bad_request(format!("max_chars must be between {MIN_SUMMARY_CHARS} and {MAX_SUMMARY_CHARS}")));
    }
    deps.db.get_ask_conversation(conversation_id)?.ok_or_else(|| not_found(conversation_id))?;
    let previous = deps.db.latest_ask_compaction(conversation_id)?;
    let covered = previous.as_ref().map(|record| record.covers_to_seq).unwrap_or(0);
    // 上一份摘要之后、要留着的最近几条之前的那段；作废的（改过的问和它之后的）不算（v43）
    let mut messages: Vec<_> = deps
        .db
        .list_live_ask_conversation_messages(conversation_id, None, MAX_MESSAGES_PER_SUMMARY + KEEP_RECENT_MESSAGES as u32)?
        .into_iter()
        .filter(|message| message.seq > covered)
        .collect();
    if messages.len() <= KEEP_RECENT_MESSAGES as usize {
        return Err(AppError::conflict_because(
            "ask_compaction_nothing",
            format!("nothing to compact: the last {KEEP_RECENT_MESSAGES} messages always stay as they are"),
        ));
    }
    messages.truncate(messages.len() - KEEP_RECENT_MESSAGES as usize);
    let covers_to_seq = messages.last().map(|message| message.seq).expect("at least one message to compact");
    // 生成摘要要等模型：先记下这段里作废的有几条，存的时候变了（中途有人改了问）就不存
    let superseded_before = deps.db.superseded_ask_messages_up_to(conversation_id, covers_to_seq)?;
    let request = serde_json::json!({
        "kind": "compaction",
        "previous_summary": previous.as_ref().map(|record| record.summary.as_str()),
        "messages": summary_messages(deps, &messages),
        "max_chars": max_chars,
    });
    let summary = summarize(&payload.connection, &request)?;
    let sources = sources_of(&messages);
    let new = NewAskCompaction { covers_to_seq, summary, sources, model: payload.connection.model.trim().to_string(), superseded_before };
    let compaction = match deps.db.insert_ask_compaction(conversation_id, &new)? {
        AskCompactionInserted::Inserted(record) => record,
        AskCompactionInserted::NotFound => return Err(not_found(conversation_id)),
        AskCompactionInserted::Stale => {
            return Err(AppError::conflict_because("ask_compaction_stale", "another compaction finished first; nothing changed"))
        }
    };
    Ok(CreateAskCompactionView {
        conversation: deps.db.get_ask_conversation(conversation_id)?.ok_or_else(|| not_found(conversation_id))?,
        compaction,
        compaction_due: compaction_due(deps, conversation_id)?,
    })
}

/// GET /ai/ask-conversations/:conversation_id/compactions：所有的摘要（旧的也在），按替代到第几条从小到大。
pub fn list_ask_compactions_view(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<AskCompactionListView, AppError> {
    deps.db.get_ask_conversation(conversation_id)?.ok_or_else(|| not_found(conversation_id))?;
    Ok(AskCompactionListView { conversation_id: conversation_id.to_string(), compactions: deps.db.list_ask_compactions(conversation_id)? })
}

/// 副对话结束、没给结论但给了模型：后端把副对话的来回压成一张结论卡片。
pub(crate) fn summarize_side(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    connection: &AskModelConnectionInput,
    summarize: &AskSummarizer<'_>,
) -> Result<Option<String>, AppError> {
    checked_connection(connection)?;
    let messages = deps.db.list_live_ask_conversation_messages(conversation_id, None, MAX_MESSAGES_PER_SUMMARY)?;
    if messages.is_empty() {
        // 什么都没聊：只结束，不回填空卡片
        return Ok(None);
    }
    let request = serde_json::json!({
        "kind": "side",
        "messages": summary_messages(deps, &messages),
        "max_chars": SIDE_SUMMARY_CHARS,
    });
    summarize(connection, &request).map(Some)
}

/// 这段消息涉及的书和页：`[{document_id, pages}]`，按第一次出现排；没有书的消息不算。
fn sources_of(messages: &[AskConversationMessageRecord]) -> Option<serde_json::Value> {
    let mut order: Vec<String> = Vec::new();
    let mut pages: HashMap<String, Vec<u32>> = HashMap::new();
    for message in messages {
        let Some(document_id) = &message.document_id else { continue };
        let entry = pages.entry(document_id.clone()).or_insert_with(|| {
            order.push(document_id.clone());
            Vec::new()
        });
        if let Some(page) = message.page {
            if !entry.contains(&page) {
                entry.push(page);
            }
        }
    }
    if order.is_empty() {
        return None;
    }
    Some(serde_json::Value::Array(
        order
            .into_iter()
            .map(|document_id| {
                let mut list = pages.remove(&document_id).unwrap_or_default();
                list.sort_unstable();
                serde_json::json!({ "document_id": document_id, "pages": list })
            })
            .collect(),
    ))
}

/// 拼上下文用：生效的那份摘要（没压过是 None）。
pub(crate) fn latest_compaction(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<Option<AskCompactionRecord>, AppError> {
    Ok(deps.db.latest_ask_compaction(conversation_id)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(seq: i64, document_id: Option<&str>, page: Option<u32>) -> AskConversationMessageRecord {
        AskConversationMessageRecord {
            message_id: format!("m{seq}"),
            conversation_id: "c".into(),
            seq,
            role: "user".into(),
            text: "t".into(),
            thought: None,
            usage: None,
            agent_id: None,
            side_conversation_id: None,
            document_id: document_id.map(str::to_string),
            job_id: None,
            version_id: None,
            pane: None,
            page,
            selection: None,
            client_message_id: None,
            created_at: String::new(),
            superseded_at: None,
            edited_from: None,
            session_id: None,
            extra_selections: vec![],
        }
    }

    use std::cell::RefCell;
    use std::path::PathBuf;

    use retainpdf_data::db::Db;

    use crate::ask_conversations::{
        append_ask_messages_view, ask_context_view, close_ask_conversation_view, create_side_ask_conversation_view,
        ensure_main_ask_conversation_view, list_ask_messages_view, supersede_ask_messages_view,
    };
    use crate::ask_views::{
        AppendAskMessagesInput, AskContextQuery, AskConversationMessageInput, CloseAskConversationInput, CreateAskSideConversationInput,
        ListAskMessagesQuery,
    };

    struct Fixture {
        db: Db,
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("retainpdf-ask-compaction-flow-{:016x}", fastrand::u64(..)));
            let db = Db::new(root.join("db.sqlite"), root.join("data"));
            db.init().unwrap();
            Self { db, root }
        }

        fn deps(&self) -> LibraryDeps<'_> {
            LibraryDeps {
                db: &self.db,
                data_root: &self.root,
                output_root: &self.root,
                downloads_dir: &self.root,
                scripts_dir: &self.root,
                python_bin: "python3",
                pipeline_command: "",
            }
        }
    }

    fn connection() -> AskModelConnectionInput {
        AskModelConnectionInput { model: "m".into(), credential_ref: "cred-1".into(), ..Default::default() }
    }

    fn turn(text: &str) -> AppendAskMessagesInput {
        let message = |role: &str| AskConversationMessageInput {
            role: role.into(),
            text: text.into(),
            thought: None,
            usage: None,
            agent_id: Some("retainpdf".into()),
            document_id: None,
            selection: None,
            client_message_id: None,
            memory_ids: vec![],
            edited_from: None,
            session_id: None,
            extra_selections: vec![],
        };
        AppendAskMessagesInput { messages: vec![message("user"), message("assistant")] }
    }

    /// 压缩：只压「上一份摘要之后、最近 12 条之前」的；上下文给摘要 + 之后的几轮；消息分页标出压缩点；再压时带上一份摘要。
    #[test]
    fn compaction_replaces_old_turns_in_the_context_and_keeps_the_originals() {
        let fixture = Fixture::new();
        let deps = fixture.deps();
        let main = ensure_main_ask_conversation_view(&deps).unwrap();
        let id = main.conversation_id.as_str();
        // 6 轮（12 条）：全是要留着的，没东西可压
        for i in 0..6 {
            append_ask_messages_view(&deps, id, &turn(&format!("第{i}轮"))).unwrap();
        }
        let requests = RefCell::new(Vec::new());
        let summarize = |connection: &AskModelConnectionInput, request: &serde_json::Value| {
            assert_eq!(connection.model, "m");
            requests.borrow_mut().push(request.clone());
            Ok(format!("摘要{}", requests.borrow().len()))
        };
        let input = CreateAskCompactionInput { connection: connection(), max_chars: None };
        let error = create_ask_compaction_view(&deps, id, &input, &summarize).unwrap_err();
        assert!(format!("{error:?}").contains("ask_compaction_nothing"), "{error:?}");
        assert!(requests.borrow().is_empty(), "nothing to compact must not call the model");

        // 再 3 轮：压前 6 条（seq 1–6），最近 12 条（seq 7–18）留着
        for i in 6..9 {
            append_ask_messages_view(&deps, id, &turn(&format!("第{i}轮"))).unwrap();
        }
        let created = create_ask_compaction_view(&deps, id, &input, &summarize).unwrap();
        assert_eq!((created.compaction.covers_to_seq, created.compaction.summary.as_str()), (6, "摘要1"));
        let first = requests.borrow()[0].clone();
        assert_eq!(first["kind"], "compaction");
        assert!(first["previous_summary"].is_null());
        assert_eq!(first["messages"].as_array().unwrap().len(), 6);
        assert_eq!(first["max_chars"], 2000);

        let context = ask_context_view(&deps, id, &AskContextQuery::default()).unwrap();
        assert_eq!((context.summary.as_deref(), context.summary_covers_to_seq), (Some("摘要1"), Some(6)));
        assert!(context.messages.iter().all(|message| message.seq > 6));
        assert!(context.text.contains("【之前对话的摘要】\n摘要1"));
        // 原文还在，分页里标出压缩点
        let page = list_ask_messages_view(&deps, id, &ListAskMessagesQuery::default()).unwrap();
        assert_eq!(page.messages.len(), 18);
        assert_eq!(page.compactions.iter().map(|point| point.covers_to_seq).collect::<Vec<_>>(), vec![6]);

        // 再 3 轮：这次带上一份摘要，只压 seq 7–12
        for i in 9..12 {
            append_ask_messages_view(&deps, id, &turn(&format!("第{i}轮"))).unwrap();
        }
        let second = create_ask_compaction_view(&deps, id, &input, &summarize).unwrap();
        assert_eq!(second.compaction.covers_to_seq, 12);
        let request = requests.borrow()[1].clone();
        assert_eq!(request["previous_summary"], "摘要1");
        assert_eq!(request["messages"][0]["seq"], 7);
        assert_eq!(list_ask_compactions_view(&deps, id).unwrap().compactions.len(), 2);
    }

    /// 改后重问（v43）：从一条问起作废，上下文、压缩点、「问过的地方」不再看作废的；改后的问带 edited_from 追加；
    /// 再压缩时跳过作废的。
    #[test]
    fn editing_a_question_supersedes_it_and_what_followed() {
        let fixture = Fixture::new();
        let deps = fixture.deps();
        let id = ensure_main_ask_conversation_view(&deps).unwrap().conversation_id;
        for i in 0..9 {
            append_ask_messages_view(&deps, &id, &turn(&format!("第{i}轮"))).unwrap();
        }
        let summarize = |_: &AskModelConnectionInput, request: &serde_json::Value| {
            Ok(format!("摘要（{} 条）", request["messages"].as_array().unwrap().len()))
        };
        let input = CreateAskCompactionInput { connection: connection(), max_chars: None };
        assert_eq!(create_ask_compaction_view(&deps, &id, &input, &summarize).unwrap().compaction.covers_to_seq, 6);

        // 改第 3 轮的问（seq 5）：seq 5–18 作废，盖到 6 的摘要作废
        let page = list_ask_messages_view(&deps, &id, &ListAskMessagesQuery::default()).unwrap();
        let asked = &page.messages[4];
        assert_eq!((asked.seq, asked.role.as_str()), (5, "user"));
        let error = supersede_ask_messages_view(&deps, &id, &page.messages[5].message_id).unwrap_err();
        assert!(format!("{error:?}").contains("role user"), "{error:?}");
        let done = supersede_ask_messages_view(&deps, &id, &asked.message_id).unwrap();
        assert_eq!(done.superseded_message_ids.len(), 14);
        assert_eq!(done.superseded_compaction_ids.len(), 1);
        let again = supersede_ask_messages_view(&deps, &id, &asked.message_id).unwrap_err();
        assert!(format!("{again:?}").contains("ask_message_superseded"), "{again:?}");

        let context = ask_context_view(&deps, &id, &AskContextQuery::default()).unwrap();
        assert_eq!(context.summary, None);
        assert_eq!(context.messages.iter().map(|message| message.seq).collect::<Vec<_>>(), vec![1, 2, 3, 4]);
        assert_eq!(context.omitted_messages, 0);
        let page = list_ask_messages_view(&deps, &id, &ListAskMessagesQuery::default()).unwrap();
        assert_eq!(page.messages.len(), 18, "the originals stay");
        assert!(page.compactions.is_empty());
        assert_eq!(list_ask_compactions_view(&deps, &id).unwrap().compactions.len(), 1);

        // 改后的问：只有 user 能带 edited_from，要指向作废的那条
        let mut edited = turn("改过的问");
        edited.messages[1].edited_from = Some(asked.message_id.clone());
        assert!(append_ask_messages_view(&deps, &id, &edited).is_err());
        edited.messages[1].edited_from = None;
        edited.messages[0].edited_from = Some(page.messages[0].message_id.clone());
        assert!(append_ask_messages_view(&deps, &id, &edited).is_err());
        edited.messages[0].edited_from = Some(asked.message_id.clone());
        let appended = append_ask_messages_view(&deps, &id, &edited).unwrap();
        assert_eq!(appended.messages[0].seq, 19);
        assert_eq!(appended.messages[0].edited_from.as_deref(), Some(asked.message_id.as_str()));

        // 再聊几轮后压缩：作废的不进摘要，最近 12 条（没作废的）留着
        for i in 0..6 {
            append_ask_messages_view(&deps, &id, &turn(&format!("新第{i}轮"))).unwrap();
        }
        let created = create_ask_compaction_view(&deps, &id, &input, &summarize).unwrap();
        assert_eq!(created.compaction.summary, "摘要（6 条）");
        assert_eq!(created.compaction.covers_to_seq, 20);
        let context = ask_context_view(&deps, &id, &AskContextQuery::default()).unwrap();
        assert_eq!(context.summary_covers_to_seq, Some(20));
        assert!(context.messages.iter().all(|message| message.seq > 20 && message.superseded_at.is_none()));
    }

    /// 上一份摘要之后超过 40000 字：追加的返回说该压了。
    #[test]
    fn appending_says_when_a_compaction_is_due() {
        let fixture = Fixture::new();
        let deps = fixture.deps();
        let id = ensure_main_ask_conversation_view(&deps).unwrap().conversation_id;
        let long = "字".repeat(15_000);
        assert!(!append_ask_messages_view(&deps, &id, &turn(&long)).unwrap().compaction_due);
        assert!(append_ask_messages_view(&deps, &id, &turn(&long)).unwrap().compaction_due);
    }

    /// 副对话结束：没给结论但给了模型，后端总结成卡片回填；给了结论就不调模型；什么都没聊不回填空卡片。
    #[test]
    fn closing_a_side_conversation_can_let_the_backend_write_the_card() {
        let fixture = Fixture::new();
        let deps = fixture.deps();
        let main = ensure_main_ask_conversation_view(&deps).unwrap();
        let appended = append_ask_messages_view(&deps, &main.conversation_id, &turn("主对话")).unwrap();
        let fork = appended.messages[1].message_id.clone();
        let side = |title: &str| {
            create_side_ask_conversation_view(
                &deps,
                &CreateAskSideConversationInput {
                    parent_id: main.conversation_id.clone(),
                    forked_from_message_id: Some(fork.clone()),
                    title: Some(title.into()),
                    document_id: None,
                },
            )
            .unwrap()
        };
        let calls = RefCell::new(0);
        let summarize = |_: &AskModelConnectionInput, request: &serde_json::Value| {
            *calls.borrow_mut() += 1;
            assert_eq!(request["kind"], "side");
            Ok("后端写的结论".to_string())
        };

        let deep = side("深挖");
        append_ask_messages_view(&deps, &deep.conversation_id, &turn("副对话里问")).unwrap();
        let closed = close_ask_conversation_view(
            &deps,
            &deep.conversation_id,
            &CloseAskConversationInput { summary: None, summarize_with: Some(connection()) },
            &summarize,
        )
        .unwrap();
        assert_eq!(closed.card.unwrap().text, "后端写的结论");
        assert_eq!(*calls.borrow(), 1);

        let given = side("自己写");
        let closed = close_ask_conversation_view(
            &deps,
            &given.conversation_id,
            &CloseAskConversationInput { summary: Some("我写的".into()), summarize_with: Some(connection()) },
            &summarize,
        )
        .unwrap();
        assert_eq!(closed.card.unwrap().text, "我写的");
        assert_eq!(*calls.borrow(), 1, "a given summary wins");

        let empty = side("空的");
        let closed = close_ask_conversation_view(
            &deps,
            &empty.conversation_id,
            &CloseAskConversationInput { summary: None, summarize_with: Some(connection()) },
            &summarize,
        )
        .unwrap();
        assert!(closed.card.is_none());
        assert_eq!(*calls.borrow(), 1, "an empty side conversation is not summarized");
    }

    #[test]
    fn sources_list_each_book_once_with_sorted_pages() {
        let messages = [
            message(1, Some("b"), Some(9)),
            message(2, None, Some(1)),
            message(3, Some("a"), None),
            message(4, Some("b"), Some(3)),
            message(5, Some("b"), Some(9)),
        ];
        assert_eq!(
            sources_of(&messages).unwrap(),
            serde_json::json!([{"document_id": "b", "pages": [3, 9]}, {"document_id": "a", "pages": []}])
        );
        assert!(sources_of(&[message(1, None, Some(2))]).is_none());
    }
}
