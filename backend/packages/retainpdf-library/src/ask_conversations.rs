//! 阅读页提问的主对话、副对话（2026-11-26，数据库 v40）：全局一个主对话，副对话从主对话某条消息分出来，结束时结论回到主对话；
//! 每条消息记自己属于哪本书和结构化出处。只追加，不整份覆盖。开新会话用的上下文（记忆 + 最近几轮）也在这里拼。
//! 方案见 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md，接口见 docs/api/16-AI/02-主对话和记忆.md。
//!
//! 放在书库领域：和 v39 的问答记录、书上的标签一样是用户数据，消息、书层记忆挂在书的文件上；ACP 桥（providers）只转发，不碰记录。
//! v39 的按书问答记录（`ask_threads.rs`）只读保留，不迁过来。

use retainpdf_api_base::error::AppError;
use retainpdf_data::db::{
    AskConversationChanges, AskConversationFilter, AskConversationMessageRecord, AskConversationRecord, AskConversationUpdated,
    AskConversationDeleted, AskMemoryFilter, AskMemoryRecord, AskMessagesAppended, AskSideClosed, AskSideCreated, NewAskConversationMessage,
    NewAskSideConversation,
};

use crate::ask_threads::{MAX_MESSAGE_TEXT_CHARS, MAX_THOUGHT_CHARS, MAX_USAGE_BYTES};
use crate::ask_views::{
    AppendAskMessagesInput, AppendAskMessagesView, AskContextMemoriesView, AskContextParentView, AskContextQuery, AskContextView,
    AskConversationDeleteResultView, AskConversationListView, AskConversationMessageInput, AskMessagePageView, AskSelectionInput,
    CloseAskConversationInput, CloseAskConversationView, CreateAskSideConversationInput, DocumentAskMessagesView,
    ListAskConversationsQuery, ListAskMessagesQuery, PatchAskConversationInput,
};
use crate::LibraryDeps;

/// 一个对话最多多少条消息（防失控；主对话一直延续，第二期有压缩以后这个数也够用很久）。
pub(crate) const MAX_MESSAGES_PER_CONVERSATION: i64 = 50_000;
/// 一次最多追加几条（一轮是一问一答两条）。
const MAX_APPEND_MESSAGES: usize = 10;
const DEFAULT_PAGE_LIMIT: u32 = 50;
const MAX_PAGE_LIMIT: u32 = 200;
/// 开新会话带最近几轮（一问一答算一轮）、最多多少字。
const DEFAULT_RECENT_TURNS: u32 = 6;
const MAX_RECENT_TURNS: u32 = 20;
const MAX_RECENT_CHARS: usize = 16_000;
/// 用户层记忆每次都带，约 2000 token；书层是当前这本书的。
pub(crate) const MAX_USER_MEMORY_CHARS: usize = 3_000;
pub(crate) const MAX_BOOK_MEMORY_CHARS: usize = 2_000;
/// 这本书上问过的地方最多列几条。
const MAX_DOCUMENT_MARKS: u32 = 2_000;
const MAX_TITLE_CHARS: usize = 200;
const MAX_SUMMARY_CHARS: usize = 8_000;
const MAX_ID_CHARS: usize = 200;
const MAX_CLIENT_ID_CHARS: usize = 128;
const MAX_MEMORY_IDS: usize = 10;
const MAX_ITEM_IDS: usize = 50;
const MAX_PAGE: u32 = 100_000;
/// 出处里的几段字超长就截断（只是出处）。
const MAX_SELECTED_CHARS: usize = 4_000;
const MAX_BLOCK_TEXT_CHARS: usize = 8_000;
const MAX_SECTION_CHARS: usize = 200;
const MAX_AROUND_CHARS: usize = 200;

pub(crate) fn truncate_chars(text: &str, max: usize) -> String {
    match text.char_indices().nth(max) {
        Some((end, _)) => text[..end].to_string(),
        None => text.to_string(),
    }
}

/// 编号（书、任务、版本、对话、消息、记忆、agent）：1–200 个字母、数字、`-_.:`。空串当没给。
pub(crate) fn checked_id(value: Option<&str>, field: &str) -> Result<Option<String>, AppError> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let valid = value.chars().count() <= MAX_ID_CHARS
        && value.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'));
    if !valid {
        return Err(AppError::bad_request(format!(
            "{field} must be 1-{MAX_ID_CHARS} characters of letters, digits, '-', '_', '.' or ':'"
        )));
    }
    Ok(Some(value.to_string()))
}

fn optional_text(value: &Option<String>, max: usize) -> Option<String> {
    value.as_deref().map(str::trim).filter(|text| !text.is_empty()).map(|text| truncate_chars(text, max))
}

/// 校验、截断出处，存成整理过的 JSON 对象（只留有值的键）。
fn checked_selection(selection: &AskSelectionInput) -> Result<(serde_json::Value, CheckedSelection), AppError> {
    if selection.page < 1 || selection.page > MAX_PAGE {
        return Err(AppError::bad_request(format!("selection.page must be between 1 and {MAX_PAGE}")));
    }
    let pane = match selection.pane.as_deref().map(str::trim).filter(|pane| !pane.is_empty()) {
        None => None,
        Some(pane @ ("source" | "translated")) => Some(pane.to_string()),
        Some(_) => return Err(AppError::bad_request("selection.pane must be source or translated")),
    };
    if selection.item_ids.len() > MAX_ITEM_IDS {
        return Err(AppError::bad_request(format!("selection.item_ids holds at most {MAX_ITEM_IDS} ids")));
    }
    let mut item_ids = Vec::with_capacity(selection.item_ids.len());
    for item_id in &selection.item_ids {
        if let Some(item_id) = checked_id(Some(item_id), "selection.item_ids[]")? {
            if !item_ids.contains(&item_id) {
                item_ids.push(item_id);
            }
        }
    }
    let checked = CheckedSelection {
        document_id: checked_id(selection.document_id.as_deref(), "selection.document_id")?,
        job_id: checked_id(selection.job_id.as_deref(), "selection.job_id")?,
        version_id: checked_id(selection.translation_version.as_deref(), "selection.translation_version")?,
        pane,
        page: selection.page,
    };
    let mut object = serde_json::Map::new();
    let mut put = |key: &str, value: Option<String>| {
        if let Some(value) = value {
            object.insert(key.to_string(), serde_json::Value::String(value));
        }
    };
    put("document_id", checked.document_id.clone());
    put("job_id", checked.job_id.clone());
    put("translation_version", checked.version_id.clone());
    put("pane", checked.pane.clone());
    put("selected_text", optional_text(&selection.selected_text, MAX_SELECTED_CHARS));
    put("section", optional_text(&selection.section, MAX_SECTION_CHARS));
    put("source_text", optional_text(&selection.source_text, MAX_BLOCK_TEXT_CHARS));
    put("translated_text", optional_text(&selection.translated_text, MAX_BLOCK_TEXT_CHARS));
    put("prefix", optional_text(&selection.prefix, MAX_AROUND_CHARS));
    put("suffix", optional_text(&selection.suffix, MAX_AROUND_CHARS));
    object.insert("page".into(), serde_json::json!(checked.page));
    object.insert("item_ids".into(), serde_json::json!(item_ids));
    Ok((serde_json::Value::Object(object), checked))
}

struct CheckedSelection {
    document_id: Option<String>,
    job_id: Option<String>,
    version_id: Option<String>,
    pane: Option<String>,
    page: u32,
}

fn checked_usage(usage: &Option<serde_json::Value>, index: usize) -> Result<Option<serde_json::Value>, AppError> {
    match usage {
        None | Some(serde_json::Value::Null) => Ok(None),
        Some(value @ serde_json::Value::Object(_)) => {
            if value.to_string().len() > MAX_USAGE_BYTES {
                return Err(AppError::bad_request(format!("messages[{index}].usage must be at most {MAX_USAGE_BYTES} bytes as JSON")));
            }
            Ok(Some(value.clone()))
        }
        Some(_) => Err(AppError::bad_request(format!("messages[{index}].usage must be an object"))),
    }
}

fn checked_message(message: &AskConversationMessageInput, index: usize) -> Result<NewAskConversationMessage, AppError> {
    if !matches!(message.role.as_str(), "user" | "assistant") {
        return Err(AppError::bad_request(format!("messages[{index}].role must be user or assistant")));
    }
    if message.text.chars().count() > MAX_MESSAGE_TEXT_CHARS {
        return Err(AppError::bad_request(format!("messages[{index}].text must be at most {MAX_MESSAGE_TEXT_CHARS} characters")));
    }
    let thought = message.thought.as_deref().filter(|thought| !thought.trim().is_empty());
    if thought.is_some_and(|thought| thought.chars().count() > MAX_THOUGHT_CHARS) {
        return Err(AppError::bad_request(format!("messages[{index}].thought must be at most {MAX_THOUGHT_CHARS} characters")));
    }
    let client_message_id = message.client_message_id.as_deref().map(str::trim).filter(|id| !id.is_empty());
    if client_message_id.is_some_and(|id| id.chars().count() > MAX_CLIENT_ID_CHARS) {
        return Err(AppError::bad_request(format!(
            "messages[{index}].client_message_id must be at most {MAX_CLIENT_ID_CHARS} characters"
        )));
    }
    if message.memory_ids.len() > MAX_MEMORY_IDS {
        return Err(AppError::bad_request(format!("messages[{index}].memory_ids holds at most {MAX_MEMORY_IDS} ids")));
    }
    let memory_ids = message
        .memory_ids
        .iter()
        .map(|id| checked_id(Some(id), "memory_ids[]"))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect();
    let document_id = checked_id(message.document_id.as_deref(), "document_id")?;
    let (selection, checked) = match &message.selection {
        Some(selection) => {
            let (value, checked) = checked_selection(selection)?;
            (Some(value), Some(checked))
        }
        None => (None, None),
    };
    let selection_document = checked.as_ref().and_then(|checked| checked.document_id.clone());
    if let (Some(document_id), Some(selection_document)) = (&document_id, &selection_document) {
        if document_id != selection_document {
            return Err(AppError::bad_request(format!("messages[{index}].document_id and selection.document_id differ")));
        }
    }
    Ok(NewAskConversationMessage {
        role: message.role.clone(),
        text: message.text.clone(),
        thought: thought.map(str::to_string),
        usage: checked_usage(&message.usage, index)?,
        agent_id: checked_id(message.agent_id.as_deref(), "agent_id")?,
        side_conversation_id: None,
        document_id: document_id.or(selection_document),
        job_id: checked.as_ref().and_then(|checked| checked.job_id.clone()),
        version_id: checked.as_ref().and_then(|checked| checked.version_id.clone()),
        pane: checked.as_ref().and_then(|checked| checked.pane.clone()),
        page: checked.as_ref().map(|checked| checked.page),
        selection,
        client_message_id: client_message_id.map(str::to_string),
        memory_ids,
    })
}

fn not_found(conversation_id: &str) -> AppError {
    AppError::not_found(format!("ask conversation not found: {conversation_id}"))
}

fn conversation_or_404(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<AskConversationRecord, AppError> {
    deps.db.get_ask_conversation(conversation_id)?.ok_or_else(|| not_found(conversation_id))
}

fn document_or_404(deps: &LibraryDeps<'_>, document_id: &str) -> Result<(), AppError> {
    deps.db
        .get_document(document_id)
        .map(|_| ())
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))
}

fn checked_title(title: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(title) = title else { return Ok(None) };
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(AppError::bad_request(format!("title must be at most {MAX_TITLE_CHARS} characters")));
    }
    Ok(Some(title))
}

// --- 对话 ---

pub fn ensure_main_ask_conversation_view(deps: &LibraryDeps<'_>) -> Result<AskConversationRecord, AppError> {
    Ok(deps.db.ensure_main_ask_conversation()?)
}

pub fn list_ask_conversations_view(
    deps: &LibraryDeps<'_>,
    query: &ListAskConversationsQuery,
) -> Result<AskConversationListView, AppError> {
    let blank = |value: &Option<String>| value.as_deref().map(str::trim).filter(|value| !value.is_empty()).map(str::to_string);
    let kind = blank(&query.kind);
    if kind.as_deref().is_some_and(|kind| !matches!(kind, "main" | "side")) {
        return Err(AppError::bad_request("kind must be main or side"));
    }
    let status = blank(&query.status);
    if status.as_deref().is_some_and(|status| !matches!(status, "open" | "closed" | "archived")) {
        return Err(AppError::bad_request("status must be open, closed or archived"));
    }
    let parent_id = checked_id(query.parent_id.as_deref(), "parent_id")?;
    let filter = AskConversationFilter { kind: kind.as_deref(), status: status.as_deref(), parent_id: parent_id.as_deref() };
    Ok(AskConversationListView { conversations: deps.db.list_ask_conversations(&filter)? })
}

pub fn create_side_ask_conversation_view(
    deps: &LibraryDeps<'_>,
    payload: &CreateAskSideConversationInput,
) -> Result<AskConversationRecord, AppError> {
    let parent_id = checked_id(Some(&payload.parent_id), "parent_id")?.ok_or_else(|| AppError::bad_request("parent_id is required"))?;
    let forked = checked_id(payload.forked_from_message_id.as_deref(), "forked_from_message_id")?;
    let document_id = checked_id(payload.document_id.as_deref(), "document_id")?;
    let title = checked_title(payload.title.as_deref())?.unwrap_or_default();
    let new = NewAskSideConversation {
        parent_id: &parent_id,
        forked_from_message_id: forked.as_deref(),
        title: &title,
        document_id: document_id.as_deref(),
    };
    match deps.db.create_side_ask_conversation(&new)? {
        AskSideCreated::Created(record) => Ok(record),
        AskSideCreated::ParentMissing => Err(not_found(&parent_id)),
        AskSideCreated::ParentNotMain => Err(AppError::bad_request("parent_id must be a main conversation (side conversations do not nest)")),
        AskSideCreated::ForkNotInParent => Err(AppError::bad_request("forked_from_message_id is not a message of the parent conversation")),
        AskSideCreated::DocumentMissing => Err(AppError::not_found(format!("document not found: {}", document_id.unwrap_or_default()))),
    }
}

pub fn get_ask_conversation_view(deps: &LibraryDeps<'_>, conversation_id: &str) -> Result<AskConversationRecord, AppError> {
    conversation_or_404(deps, conversation_id)
}

pub fn patch_ask_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &PatchAskConversationInput,
) -> Result<AskConversationRecord, AppError> {
    let title = checked_title(payload.title.as_deref())?;
    let status = payload.status.as_deref().map(str::trim);
    if status.is_some_and(|status| !matches!(status, "open" | "closed" | "archived")) {
        return Err(AppError::bad_request("status must be open, closed or archived"));
    }
    let changes = AskConversationChanges { title: title.as_deref(), status };
    match deps.db.update_ask_conversation(conversation_id, &changes)? {
        AskConversationUpdated::Updated(record) => Ok(record),
        AskConversationUpdated::NotFound => Err(not_found(conversation_id)),
        AskConversationUpdated::BadStatus => Err(AppError::bad_request("a main conversation is open or archived; only side conversations close")),
        AskConversationUpdated::AnotherOpenMain => Err(AppError::conflict_because(
            "ask_main_conversation_open",
            "another main conversation is open; archive it first",
        )),
    }
}

pub fn delete_ask_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<AskConversationDeleteResultView, AppError> {
    match deps.db.delete_ask_conversation(conversation_id)? {
        AskConversationDeleted::Deleted => {
            Ok(AskConversationDeleteResultView { conversation_id: conversation_id.to_string(), deleted: true })
        }
        AskConversationDeleted::NotFound => Err(not_found(conversation_id)),
        // 2026-11-26 用户定：主对话只能先归档（界面上是「归档并开新的主对话」）再删
        AskConversationDeleted::MainStillOpen => Err(AppError::conflict_because(
            "ask_main_conversation_open",
            format!("ask conversation {conversation_id} is the open main conversation; archive it before deleting"),
        )),
    }
}

pub fn close_ask_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &CloseAskConversationInput,
) -> Result<CloseAskConversationView, AppError> {
    let summary = payload.summary.as_deref().map(str::trim).filter(|summary| !summary.is_empty());
    if summary.is_some_and(|summary| summary.chars().count() > MAX_SUMMARY_CHARS) {
        return Err(AppError::bad_request(format!("summary must be at most {MAX_SUMMARY_CHARS} characters")));
    }
    match deps.db.close_side_ask_conversation(conversation_id, summary)? {
        AskSideClosed::Closed(conversation, card) => Ok(CloseAskConversationView { conversation, card }),
        AskSideClosed::NotFound => Err(not_found(conversation_id)),
        AskSideClosed::NotSide => Err(AppError::bad_request("only side conversations can be closed")),
    }
}

// --- 消息 ---

pub fn list_ask_messages_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    query: &ListAskMessagesQuery,
) -> Result<AskMessagePageView, AppError> {
    conversation_or_404(deps, conversation_id)?;
    let limit = query.limit.unwrap_or(DEFAULT_PAGE_LIMIT);
    if !(1..=MAX_PAGE_LIMIT).contains(&limit) {
        return Err(AppError::bad_request(format!("limit must be between 1 and {MAX_PAGE_LIMIT}")));
    }
    let mut messages = deps.db.list_ask_conversation_messages(conversation_id, query.before_seq, limit + 1)?;
    let has_more = messages.len() > limit as usize;
    if has_more {
        messages.remove(0);
    }
    Ok(AskMessagePageView { conversation_id: conversation_id.to_string(), messages, has_more })
}

pub fn append_ask_messages_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &AppendAskMessagesInput,
) -> Result<AppendAskMessagesView, AppError> {
    if payload.messages.is_empty() || payload.messages.len() > MAX_APPEND_MESSAGES {
        return Err(AppError::bad_request(format!("messages must hold 1-{MAX_APPEND_MESSAGES} messages")));
    }
    let messages = payload
        .messages
        .iter()
        .enumerate()
        .map(|(index, message)| checked_message(message, index))
        .collect::<Result<Vec<_>, _>>()?;
    match deps.db.append_ask_conversation_messages(conversation_id, &messages, MAX_MESSAGES_PER_CONVERSATION)? {
        AskMessagesAppended::Appended(messages) => {
            Ok(AppendAskMessagesView { conversation: conversation_or_404(deps, conversation_id)?, messages })
        }
        AskMessagesAppended::NotFound => Err(not_found(conversation_id)),
        AskMessagesAppended::NotOpen => Err(AppError::conflict_because(
            "ask_conversation_not_open",
            format!("ask conversation {conversation_id} is closed or archived; reopen it first"),
        )),
        AskMessagesAppended::TooMany => Err(AppError::conflict_because_with(
            "ask_conversation_limit",
            format!("ask conversation {conversation_id} already holds {MAX_MESSAGES_PER_CONVERSATION} messages"),
            serde_json::json!({ "limit": MAX_MESSAGES_PER_CONVERSATION }),
        )),
    }
}

pub fn document_ask_messages_view(deps: &LibraryDeps<'_>, document_id: &str) -> Result<DocumentAskMessagesView, AppError> {
    document_or_404(deps, document_id)?;
    Ok(DocumentAskMessagesView {
        document_id: document_id.to_string(),
        messages: deps.db.list_document_ask_messages(document_id, MAX_DOCUMENT_MARKS)?,
    })
}

// --- 开新会话的上下文 ---

/// 最近几条，从后往前取，字数到上限就停（至少一条，太长截断）。返回（取到的，没带的条数）。
fn recent_messages(mut messages: Vec<AskConversationMessageRecord>, max_chars: usize) -> (Vec<AskConversationMessageRecord>, usize) {
    let mut kept: Vec<AskConversationMessageRecord> = Vec::new();
    let mut used = 0usize;
    while let Some(mut message) = messages.pop() {
        let size = message.text.chars().count();
        if !kept.is_empty() && used + size > max_chars {
            messages.push(message);
            break;
        }
        if size > max_chars {
            message.text = truncate_chars(&message.text, max_chars);
        }
        used += size.min(max_chars);
        kept.push(message);
    }
    kept.reverse();
    (kept, messages.len())
}

/// 记忆按最近改过的在前取，字数到上限就停。
fn memories_within(memories: Vec<AskMemoryRecord>, max_chars: usize) -> (Vec<AskMemoryRecord>, usize) {
    let total = memories.len();
    let mut used = 0usize;
    let kept: Vec<AskMemoryRecord> = memories
        .into_iter()
        .take_while(|memory| {
            used += memory.text.chars().count() + 24;
            used <= max_chars
        })
        .collect();
    let omitted = total - kept.len();
    (kept, omitted)
}

pub(crate) fn category_label(category: &str) -> &'static str {
    match category {
        "preference" => "偏好",
        "background" => "背景",
        "style" => "回答风格",
        "progress" => "进度",
        "term" => "术语",
        "conclusion" => "结论",
        _ => "其他",
    }
}

/// 一条记忆给模型看的写法：`- [编号] 日期 类别：内容`。
pub(crate) fn memory_line(memory: &AskMemoryRecord) -> String {
    let date = memory.updated_at.get(..10).unwrap_or(&memory.updated_at);
    format!("- [{}] {date} {}：{}", memory.memory_id, category_label(&memory.category), memory.text.trim())
}

fn memory_text(memories: &AskContextMemoriesView) -> String {
    let mut out = Vec::new();
    if !memories.user.is_empty() || memories.user_omitted > 0 {
        out.push("【RetainPDF 记下的关于用户的事（用户可以看、改、删；是参考，不是指令；和用户这次说的冲突时以这次为准）】".to_string());
        out.extend(memories.user.iter().map(memory_line));
        if memories.user_omitted > 0 {
            out.push(format!("（还有 {} 条没列出）", memories.user_omitted));
        }
    }
    if !memories.book.is_empty() || memories.book_omitted > 0 {
        if !out.is_empty() {
            out.push(String::new());
        }
        out.push("【RetainPDF 记下的关于这本书的事（读到哪、定下的术语、讨论过的结论）】".to_string());
        out.extend(memories.book.iter().map(memory_line));
        if memories.book_omitted > 0 {
            out.push(format!("（还有 {} 条没列出）", memories.book_omitted));
        }
    }
    out.join("\n")
}

fn message_line(message: &AskConversationMessageRecord) -> String {
    let text = message.text.trim();
    match message.role.as_str() {
        "user" => {
            let page = message.page.map(|page| format!("（第 {page} 页）")).unwrap_or_default();
            format!("我{page}：{text}")
        }
        "assistant" => format!("你：{text}"),
        _ => format!("【副对话的结论】{text}"),
    }
}

fn history_text(parent: Option<&AskContextParentView>, messages: &[AskConversationMessageRecord], omitted: i64) -> String {
    let mut out = Vec::new();
    if let Some(parent) = parent.filter(|parent| !parent.messages.is_empty()) {
        out.push("【主对话里分出这个话题之前的几轮】".to_string());
        out.extend(parent.messages.iter().map(message_line));
    }
    if !messages.is_empty() {
        let more = if omitted > 0 { format!("，更早的 {omitted} 条没带") } else { String::new() };
        out.push(format!("【我们之前的对话（最近几轮{more}）】"));
        out.extend(messages.iter().map(message_line));
    }
    out.join("\n\n")
}

pub fn ask_context_view(deps: &LibraryDeps<'_>, conversation_id: &str, query: &AskContextQuery) -> Result<AskContextView, AppError> {
    let conversation = conversation_or_404(deps, conversation_id)?;
    let turns = query.recent_turns.unwrap_or(DEFAULT_RECENT_TURNS);
    if !(1..=MAX_RECENT_TURNS).contains(&turns) {
        return Err(AppError::bad_request(format!("recent_turns must be between 1 and {MAX_RECENT_TURNS}")));
    }
    let document_id = checked_id(query.document_id.as_deref(), "document_id")?;
    let fetched = deps.db.list_ask_conversation_messages(conversation_id, None, turns * 2)?;
    let messages = recent_messages(fetched, MAX_RECENT_CHARS).0;
    let omitted_messages = conversation.message_count - messages.len() as i64;
    // 副对话：带主对话到分叉那条为止的最近几轮
    let parent = match (&conversation.parent_id, &conversation.forked_from_message_id) {
        (Some(parent_id), Some(fork_id)) => match deps.db.get_ask_conversation_message(fork_id)? {
            Some(fork) => {
                let before = deps.db.list_ask_conversation_messages(parent_id, Some(fork.seq + 1), turns * 2)?;
                Some(AskContextParentView { conversation_id: parent_id.clone(), messages: recent_messages(before, MAX_RECENT_CHARS / 2).0 })
            }
            None => None,
        },
        _ => None,
    };
    // 「让 AI 使用记忆」关着：不带记忆（已经记下的都留着）
    let memory_enabled = deps.db.ask_settings()?.memory_enabled;
    let user = if memory_enabled {
        deps.db.list_ask_memories(&AskMemoryFilter { scope: Some("user"), limit: 500, ..Default::default() })?
    } else {
        Vec::new()
    };
    let (user, user_omitted) = memories_within(user, MAX_USER_MEMORY_CHARS);
    let (book, book_omitted) = match document_id.as_deref().filter(|_| memory_enabled) {
        Some(document_id) => {
            let book = deps.db.list_ask_memories(&AskMemoryFilter {
                scope: Some("book"),
                document_id: Some(document_id),
                limit: 500,
                ..Default::default()
            })?;
            memories_within(book, MAX_BOOK_MEMORY_CHARS)
        }
        None => (Vec::new(), 0),
    };
    let memories = AskContextMemoriesView { user, user_omitted, book, book_omitted };
    let memory_text = memory_text(&memories);
    let history = history_text(parent.as_ref(), &messages, omitted_messages);
    let text = [memory_text.as_str(), history.as_str()].iter().filter(|part| !part.is_empty()).cloned().collect::<Vec<_>>().join("\n\n");
    Ok(AskContextView { conversation, memory_enabled, summary: None, parent, messages, omitted_messages, memories, memory_text, text })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn selection(page: u32) -> AskSelectionInput {
        AskSelectionInput {
            document_id: Some(" doc-1 ".into()),
            job_id: Some("job-1".into()),
            translation_version: None,
            pane: Some("translated".into()),
            page,
            item_ids: vec!["p1-b2".into(), "p1-b2".into(), " ".into()],
            selected_text: Some("选".repeat(MAX_SELECTED_CHARS + 5)),
            section: Some("  ".into()),
            source_text: None,
            translated_text: None,
            prefix: None,
            suffix: None,
        }
    }

    fn message(role: &str) -> AskConversationMessageInput {
        AskConversationMessageInput {
            role: role.into(),
            text: "问".into(),
            thought: None,
            usage: None,
            agent_id: Some("retainpdf".into()),
            document_id: None,
            selection: Some(selection(3)),
            client_message_id: Some(" c-1 ".into()),
            memory_ids: vec![],
        }
    }

    #[test]
    fn selections_are_normalized_and_bad_ones_refused() {
        let (value, checked) = checked_selection(&selection(3)).unwrap();
        assert_eq!(value["item_ids"], serde_json::json!(["p1-b2"]));
        assert_eq!(value["selected_text"].as_str().unwrap().chars().count(), MAX_SELECTED_CHARS);
        assert!(value.get("section").is_none() && value.get("translation_version").is_none());
        assert_eq!((checked.document_id.as_deref(), checked.page), (Some("doc-1"), 3));
        assert!(checked_selection(&selection(0)).is_err());
        let mut bad = selection(1);
        bad.pane = Some("left".into());
        assert!(checked_selection(&bad).is_err());
        bad = selection(1);
        bad.job_id = Some("../etc".into());
        assert!(checked_selection(&bad).is_err());
    }

    #[test]
    fn messages_take_the_book_from_the_selection_and_check_roles() {
        let checked = checked_message(&message("user"), 0).unwrap();
        assert_eq!((checked.document_id.as_deref(), checked.page, checked.client_message_id.as_deref()), (Some("doc-1"), Some(3), Some("c-1")));
        assert!(checked_message(&message("side_summary"), 0).is_err());
        let mut differ = message("user");
        differ.document_id = Some("doc-2".into());
        assert!(checked_message(&differ, 0).is_err());
        let mut usage = message("assistant");
        usage.usage = Some(serde_json::json!([1]));
        assert!(checked_message(&usage, 0).is_err());
    }

    fn record(seq: i64, text: &str) -> AskConversationMessageRecord {
        AskConversationMessageRecord {
            message_id: format!("m{seq}"),
            conversation_id: "c".into(),
            seq,
            role: if seq % 2 == 1 { "user".into() } else { "assistant".into() },
            text: text.into(),
            thought: None,
            usage: None,
            agent_id: None,
            side_conversation_id: None,
            document_id: None,
            job_id: None,
            version_id: None,
            pane: None,
            page: (seq % 2 == 1).then_some(5),
            selection: None,
            client_message_id: None,
            created_at: String::new(),
        }
    }

    #[test]
    fn recent_messages_stop_at_the_char_budget_but_keep_at_least_one() {
        let (kept, omitted) = recent_messages(vec![record(1, "aaaa"), record(2, "bbbb"), record(3, "cc")], 7);
        assert_eq!((kept.iter().map(|m| m.seq).collect::<Vec<_>>(), omitted), (vec![2, 3], 1));
        let (kept, _) = recent_messages(vec![record(1, &"x".repeat(50))], 10);
        assert_eq!(kept[0].text.len(), 10);
        assert_eq!(history_text(None, &kept[..0], 0), "");
        let text = history_text(None, &[record(1, "问"), record(2, "答")], 3);
        assert!(text.contains("更早的 3 条没带") && text.contains("我（第 5 页）：问") && text.contains("你：答"), "{text}");
    }
}
