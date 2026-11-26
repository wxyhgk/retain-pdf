//! 阅读页提问的问答记录（2026-11-25，数据库 v39）：按书存每次提问（书页上的一个「?」）、它的锚点和问答。
//! 方案见 docs/ops/planning/reader-ask/20261125-第3步：问答记录.md，接口见 docs/api/16-AI/01-阅读页提问.md。
//!
//! 放在书库领域：记录挂在书的文件上（`item_files`），删书跟着删，和译文版本、标签一样是「书上的用户数据」；
//! ACP 桥（providers 领域）只管转发，不碰记录。

use retainpdf_api_base::error::AppError;
use retainpdf_data::db::{
    AskAnchorRecord, AskMessageRecord, AskPoint, AskThreadChanges, AskThreadCreated, AskThreadRecord, NewAskThread,
};

use crate::views::{
    AskAnchorInput, AskMessageInput, AskThreadDeleteResultView, AskThreadListView, AskThreadView,
    CreateAskThreadInput, PatchAskThreadInput,
};
use crate::LibraryDeps;

/// 一本书最多记几次提问（多了 409 `ask_thread_limit`，先删旧的）。
pub(crate) const MAX_THREADS_PER_DOCUMENT: i64 = 500;
/// 一次提问最多几条问答（一问一答算两条）。
pub(crate) const MAX_MESSAGES_PER_THREAD: usize = 200;
/// 一条问或答的正文最长几个字。
pub(crate) const MAX_MESSAGE_TEXT_CHARS: usize = 50_000;
/// 一条思考摘要最长几个字。
pub(crate) const MAX_THOUGHT_CHARS: usize = 20_000;
/// 一次提问全部正文和思考加起来最多多少字节（UTF-8）。
pub(crate) const MAX_THREAD_TEXT_BYTES: usize = 1_000_000;
/// 一条用量（JSON 对象写成文字）最多多少字节。
pub(crate) const MAX_USAGE_BYTES: usize = 4_096;
/// 锚点里的几段字超长就截断（它们只是出处，不是记录本身）：选中的字、那一块的原文和译文、章节。
const MAX_SELECTION_CHARS: usize = 4_000;
const MAX_BLOCK_TEXT_CHARS: usize = 8_000;
const MAX_SECTION_CHARS: usize = 200;
const MAX_ITEM_ID_CHARS: usize = 200;
const MAX_AGENT_ID_CHARS: usize = 64;
const MAX_SESSION_ID_CHARS: usize = 256;
/// 标题：第一句问，空白压成一个空格，最长几个字。
const MAX_TITLE_CHARS: usize = 80;

fn truncate_chars(text: &str, max: usize) -> String {
    match text.char_indices().nth(max) {
        Some((end, _)) => text[..end].to_string(),
        None => text.to_string(),
    }
}

fn checked_agent_id(agent_id: &str) -> Result<&str, AppError> {
    let agent_id = agent_id.trim();
    let valid = !agent_id.is_empty()
        && agent_id.chars().count() <= MAX_AGENT_ID_CHARS
        && agent_id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !valid {
        return Err(AppError::bad_request(format!(
            "agent_id must be 1-{MAX_AGENT_ID_CHARS} characters of letters, digits, '-', '_' or '.'"
        )));
    }
    Ok(agent_id)
}

/// 空串当没有。
fn checked_session_id(session_id: Option<&str>) -> Result<Option<&str>, AppError> {
    let session_id = session_id.map(str::trim).filter(|id| !id.is_empty());
    if session_id.is_some_and(|id| id.chars().count() > MAX_SESSION_ID_CHARS) {
        return Err(AppError::bad_request(format!("session_id must be at most {MAX_SESSION_ID_CHARS} characters")));
    }
    Ok(session_id)
}

fn checked_anchor(anchor: &AskAnchorInput) -> Result<AskAnchorRecord, AppError> {
    if !matches!(anchor.pane.as_str(), "source" | "translated") {
        return Err(AppError::bad_request("anchor.pane must be source or translated"));
    }
    if anchor.page < 1 {
        return Err(AppError::bad_request("anchor.page must be at least 1"));
    }
    let item_id = anchor.item_id.as_deref().map(str::trim).filter(|id| !id.is_empty());
    if item_id.is_some_and(|id| id.chars().count() > MAX_ITEM_ID_CHARS) {
        return Err(AppError::bad_request(format!("anchor.item_id must be at most {MAX_ITEM_ID_CHARS} characters")));
    }
    let point = match &anchor.point {
        Some(point) => {
            let in_page = |value: f64| value.is_finite() && (0.0..=1.0).contains(&value);
            if !in_page(point.x) || !in_page(point.y) {
                return Err(AppError::bad_request("anchor.point.x and anchor.point.y must be between 0 and 1"));
            }
            Some(AskPoint { x: point.x, y: point.y })
        }
        None => None,
    };
    let text = |value: &Option<String>, max: usize| truncate_chars(value.as_deref().unwrap_or("").trim(), max);
    Ok(AskAnchorRecord {
        pane: anchor.pane.clone(),
        page: anchor.page,
        item_id: item_id.map(str::to_string),
        selection: text(&anchor.selection, MAX_SELECTION_CHARS),
        source_text: text(&anchor.source_text, MAX_BLOCK_TEXT_CHARS),
        translated_text: text(&anchor.translated_text, MAX_BLOCK_TEXT_CHARS),
        section: text(&anchor.section, MAX_SECTION_CHARS),
        point,
    })
}

fn checked_messages(messages: &[AskMessageInput]) -> Result<Vec<AskMessageRecord>, AppError> {
    if messages.len() > MAX_MESSAGES_PER_THREAD {
        return Err(AppError::bad_request(format!("a thread holds at most {MAX_MESSAGES_PER_THREAD} messages")));
    }
    let mut total_bytes = 0usize;
    let mut out = Vec::with_capacity(messages.len());
    for (index, message) in messages.iter().enumerate() {
        if !matches!(message.role.as_str(), "user" | "assistant") {
            return Err(AppError::bad_request(format!("messages[{index}].role must be user or assistant")));
        }
        if message.text.chars().count() > MAX_MESSAGE_TEXT_CHARS {
            return Err(AppError::bad_request(format!(
                "messages[{index}].text must be at most {MAX_MESSAGE_TEXT_CHARS} characters"
            )));
        }
        let thought = message.thought.as_deref().filter(|thought| !thought.trim().is_empty());
        if thought.is_some_and(|thought| thought.chars().count() > MAX_THOUGHT_CHARS) {
            return Err(AppError::bad_request(format!(
                "messages[{index}].thought must be at most {MAX_THOUGHT_CHARS} characters"
            )));
        }
        let usage = match &message.usage {
            None | Some(serde_json::Value::Null) => None,
            Some(value @ serde_json::Value::Object(_)) => {
                if value.to_string().len() > MAX_USAGE_BYTES {
                    return Err(AppError::bad_request(format!(
                        "messages[{index}].usage must be at most {MAX_USAGE_BYTES} bytes as JSON"
                    )));
                }
                Some(value.clone())
            }
            Some(_) => return Err(AppError::bad_request(format!("messages[{index}].usage must be an object"))),
        };
        total_bytes += message.text.len() + thought.map_or(0, str::len);
        if total_bytes > MAX_THREAD_TEXT_BYTES {
            return Err(AppError::bad_request(format!(
                "a thread's messages and thoughts must be at most {MAX_THREAD_TEXT_BYTES} bytes in total"
            )));
        }
        out.push(AskMessageRecord {
            role: message.role.clone(),
            text: message.text.clone(),
            thought: thought.map(str::to_string),
            usage,
        });
    }
    Ok(out)
}

/// 标题是第一句问（空白压成一个空格，截到 80 个字）；还没问是空串。
fn title_of(messages: &[AskMessageRecord]) -> String {
    let first = messages.iter().find(|message| message.role == "user").map(|message| message.text.as_str()).unwrap_or("");
    truncate_chars(&first.split_whitespace().collect::<Vec<_>>().join(" "), MAX_TITLE_CHARS)
}

fn document_or_404(deps: &LibraryDeps<'_>, document_id: &str) -> Result<(), AppError> {
    deps.db
        .get_document(document_id)
        .map(|_| ())
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))
}

fn thread_not_found(document_id: &str, thread_id: &str) -> AppError {
    AppError::not_found(format!("ask thread not found in document {document_id}: {thread_id}"))
}

fn full_view(deps: &LibraryDeps<'_>, thread: AskThreadRecord) -> Result<AskThreadView, AppError> {
    let messages = deps.db.ask_thread_messages(&thread.thread_id)?;
    Ok(AskThreadView { thread, messages })
}

pub fn list_ask_threads_view(deps: &LibraryDeps<'_>, document_id: &str) -> Result<AskThreadListView, AppError> {
    document_or_404(deps, document_id)?;
    Ok(AskThreadListView { threads: deps.db.list_ask_threads(document_id)? })
}

pub fn create_ask_thread_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    payload: &CreateAskThreadInput,
) -> Result<AskThreadView, AppError> {
    let agent_id = checked_agent_id(&payload.agent_id)?;
    let session_id = checked_session_id(payload.session_id.as_deref())?;
    let anchor = checked_anchor(&payload.anchor)?;
    let messages = checked_messages(&payload.messages)?;
    let title = title_of(&messages);
    let new = NewAskThread { document_id, agent_id, session_id, title: &title, anchor: &anchor, messages: &messages };
    match deps
        .db
        .create_ask_thread(&new, MAX_THREADS_PER_DOCUMENT)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?
    {
        AskThreadCreated::Created(thread) => full_view(deps, thread),
        AskThreadCreated::LimitReached => Err(AppError::conflict_because_with(
            "ask_thread_limit",
            format!("document {document_id} already has {MAX_THREADS_PER_DOCUMENT} ask threads; delete some first"),
            serde_json::json!({ "limit": MAX_THREADS_PER_DOCUMENT }),
        )),
    }
}

pub fn get_ask_thread_view(deps: &LibraryDeps<'_>, document_id: &str, thread_id: &str) -> Result<AskThreadView, AppError> {
    let thread = deps.db.get_ask_thread(document_id, thread_id)?.ok_or_else(|| thread_not_found(document_id, thread_id))?;
    full_view(deps, thread)
}

pub fn patch_ask_thread_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    thread_id: &str,
    payload: &PatchAskThreadInput,
) -> Result<AskThreadView, AppError> {
    let agent_id = payload.agent_id.as_deref().map(checked_agent_id).transpose()?;
    let session_id = payload
        .session_id
        .as_ref()
        .map(|session_id| checked_session_id(session_id.as_deref()))
        .transpose()?;
    let messages = payload.messages.as_deref().map(checked_messages).transpose()?;
    let title = messages.as_deref().map(title_of);
    let changes = AskThreadChanges {
        agent_id,
        session_id,
        messages: messages.as_deref().zip(title.as_deref()),
    };
    let thread = deps
        .db
        .update_ask_thread(document_id, thread_id, &changes)?
        .ok_or_else(|| thread_not_found(document_id, thread_id))?;
    full_view(deps, thread)
}

pub fn delete_ask_thread_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    thread_id: &str,
) -> Result<AskThreadDeleteResultView, AppError> {
    let session_id = deps.db.get_ask_thread(document_id, thread_id)?.and_then(|thread| thread.session_id);
    if !deps.db.delete_ask_thread(document_id, thread_id)? {
        return Err(thread_not_found(document_id, thread_id));
    }
    forget_agent_sessions(deps, session_id.into_iter().collect());
    Ok(AskThreadDeleteResultView { thread_id: thread_id.to_string(), deleted: true })
}

/// 提问删了（或书删了）以后，删掉 agent 自己存的那份对话：现在只有 `retainpdf-pi`，会话文件在
/// `<数据目录>/ask-pi/sessions/`（2026-11-26，S53）。还有别的提问记着同一个会话的留着；没记会话编号的
/// 老提问对不上，留着。在库里的行删除提交之后调，删不掉只记日志。
pub(crate) fn forget_agent_sessions(deps: &LibraryDeps<'_>, session_ids: Vec<String>) {
    let unused: Vec<String> = session_ids
        .into_iter()
        .filter(|session_id| match deps.db.ask_session_in_use(session_id) {
            Ok(in_use) => !in_use,
            Err(error) => {
                tracing::warn!(%session_id, %error, "cannot check whether an ask session is still used; keeping it");
                false
            }
        })
        .collect();
    if unused.is_empty() {
        return;
    }
    let result = retainpdf_providers::remove_pi_sessions(deps.data_root, &unused);
    if result.failed > 0 {
        tracing::warn!(failed = result.failed, removed = result.removed, "some pi session files were not removed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(role: &str, text: &str) -> AskMessageInput {
        AskMessageInput { role: role.to_string(), text: text.to_string(), thought: None, usage: None }
    }

    #[test]
    fn title_is_the_first_question_with_whitespace_collapsed() {
        let messages = checked_messages(&[message("assistant", "hi"), message("user", "  这是\n什么   东西 "), message("user", "x")]).unwrap();
        assert_eq!(title_of(&messages), "这是 什么 东西");
        let long = checked_messages(&[message("user", &"问".repeat(200))]).unwrap();
        assert_eq!(title_of(&long).chars().count(), MAX_TITLE_CHARS);
        assert_eq!(title_of(&[]), "");
    }

    #[test]
    fn messages_are_checked_for_role_size_and_usage_shape() {
        assert!(checked_messages(&[message("system", "x")]).is_err());
        assert!(checked_messages(&[message("user", &"字".repeat(MAX_MESSAGE_TEXT_CHARS + 1))]).is_err());
        assert!(checked_messages(&[message("user", &"字".repeat(MAX_MESSAGE_TEXT_CHARS))]).is_ok());
        let too_many: Vec<_> = (0..=MAX_MESSAGES_PER_THREAD).map(|_| message("user", "x")).collect();
        assert!(checked_messages(&too_many).is_err());
        // 每条都不超、加起来超
        let big = "a".repeat(MAX_MESSAGE_TEXT_CHARS);
        let many_big: Vec<_> = (0..(MAX_THREAD_TEXT_BYTES / MAX_MESSAGE_TEXT_CHARS + 1)).map(|_| message("assistant", &big)).collect();
        assert!(checked_messages(&many_big).is_err());
        let mut with_usage = message("assistant", "a");
        with_usage.usage = Some(serde_json::json!([1, 2]));
        assert!(checked_messages(&[with_usage]).is_err());
        let mut blank_thought = message("assistant", "a");
        blank_thought.thought = Some("  ".to_string());
        blank_thought.usage = Some(serde_json::Value::Null);
        let checked = checked_messages(&[blank_thought]).unwrap();
        assert_eq!((checked[0].thought.clone(), checked[0].usage.clone()), (None, None));
    }

    #[test]
    fn anchor_texts_are_truncated_and_bad_anchors_refused() {
        let anchor = |pane: &str, page: u32| AskAnchorInput {
            pane: pane.to_string(),
            page,
            item_id: Some(" ".to_string()),
            selection: Some("选".repeat(MAX_SELECTION_CHARS + 10)),
            source_text: None,
            translated_text: None,
            section: Some(" 第一章 ".to_string()),
            point: None,
        };
        let checked = checked_anchor(&anchor("translated", 3)).unwrap();
        assert_eq!(checked.selection.chars().count(), MAX_SELECTION_CHARS);
        assert_eq!((checked.item_id, checked.section.as_str(), checked.source_text.as_str()), (None, "第一章", ""));
        assert!(checked_anchor(&anchor("left", 3)).is_err());
        assert!(checked_anchor(&anchor("source", 0)).is_err());
        let mut outside = anchor("source", 1);
        outside.point = Some(crate::views::AskPointInput { x: 0.5, y: 1.5 });
        assert!(checked_anchor(&outside).is_err());
    }

    #[test]
    fn agent_and_session_ids_are_checked() {
        assert_eq!(checked_agent_id(" claude-code ").unwrap(), "claude-code");
        assert!(checked_agent_id("").is_err());
        assert!(checked_agent_id("a b").is_err());
        assert_eq!(checked_session_id(Some("  ")).unwrap(), None);
        assert!(checked_session_id(Some(&"s".repeat(MAX_SESSION_ID_CHARS + 1))).is_err());
    }
}
