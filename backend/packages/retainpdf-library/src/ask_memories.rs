//! 阅读页提问的记忆（2026-11-26，数据库 v40）：用户层（偏好、背景、回答风格）和书层（读到哪、定下的术语、结论）。
//! 用户在记忆面板里增删改查，自带 agent 用 `remember` / `search_memories` 经这里读写（`by(agent)`）。
//! 新旧冲突时旧的标 superseded、不覆盖；删是标 deleted（撤销一次「记住」，被它替代的旧条回到 active）。
//! 方案见 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md，接口见 docs/api/16-AI/02-主对话和记忆.md。

use retainpdf_api_base::error::AppError;
use retainpdf_data::db::{AskMemoryCreated, AskMemoryFilter, AskMemoryRecord, AskSettingsRecord, NewAskMemory};

use crate::ask_conversations::{checked_id, truncate_chars};
use crate::ask_views::{
    AskMemoryCreatedView, AskMemoryListView, CreateAskMemoryInput, ListAskMemoriesQuery, PatchAskMemoryInput, PatchAskSettingsInput,
};
use crate::LibraryDeps;

/// 一条最多几个字（一条记一件事）。
pub(crate) const MAX_MEMORY_CHARS: usize = 500;
/// 每层最多几条 active（书层按书算）；多了 409 `ask_memory_limit`，先删旧的或用 `replaces`。
const MAX_USER_MEMORIES: i64 = 200;
const MAX_BOOK_MEMORIES: i64 = 500;
const DEFAULT_LIST_LIMIT: u32 = 100;
const MAX_LIST_LIMIT: u32 = 500;
const MAX_QUERY_CHARS: usize = 200;
const CATEGORIES: [&str; 7] = ["preference", "background", "style", "progress", "term", "conclusion", "other"];

fn not_found(memory_id: &str) -> AppError {
    AppError::not_found(format!("memory not found: {memory_id}"))
}

fn checked_text(text: &str) -> Result<String, AppError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::bad_request("text must not be empty"));
    }
    if text.chars().count() > MAX_MEMORY_CHARS {
        return Err(AppError::bad_request(format!("text must be at most {MAX_MEMORY_CHARS} characters (one memory, one fact)")));
    }
    Ok(text.to_string())
}

fn checked_category(category: Option<&str>) -> Result<Option<String>, AppError> {
    match category.map(str::trim).filter(|category| !category.is_empty()) {
        None => Ok(None),
        Some(category) if CATEGORIES.contains(&category) => Ok(Some(category.to_string())),
        Some(_) => Err(AppError::bad_request(format!("category must be one of {}", CATEGORIES.join(", ")))),
    }
}

fn checked_scope(scope: &str) -> Result<&'static str, AppError> {
    match scope.trim() {
        "user" => Ok("user"),
        "book" => Ok("book"),
        _ => Err(AppError::bad_request("scope must be user or book")),
    }
}

/// 查到的对话摘要每份最多交出去多少字（整份最多 8000 字，agent 只要知道聊过什么、在哪）。
const MAX_SUMMARY_HIT_CHARS: usize = 1000;

pub fn list_ask_memories_view(deps: &LibraryDeps<'_>, query: &ListAskMemoriesQuery) -> Result<AskMemoryListView, AppError> {
    let scope = match query.scope.as_deref().map(str::trim).filter(|scope| !scope.is_empty()) {
        Some(scope) => Some(checked_scope(scope)?),
        None => None,
    };
    let statuses: Vec<&str> = match query.status.as_deref().map(str::trim).unwrap_or("") {
        "" | "active" => vec!["active"],
        "superseded" => vec!["superseded"],
        "deleted" => vec!["deleted"],
        "all" => vec!["active", "superseded", "deleted"],
        _ => return Err(AppError::bad_request("status must be active, superseded, deleted or all")),
    };
    let limit = query.limit.unwrap_or(DEFAULT_LIST_LIMIT);
    if !(1..=MAX_LIST_LIMIT).contains(&limit) {
        return Err(AppError::bad_request(format!("limit must be between 1 and {MAX_LIST_LIMIT}")));
    }
    let q = query.q.as_deref().map(str::trim).filter(|q| !q.is_empty());
    if q.is_some_and(|q| q.chars().count() > MAX_QUERY_CHARS) {
        return Err(AppError::bad_request(format!("q must be at most {MAX_QUERY_CHARS} characters")));
    }
    let document_id = checked_id(query.document_id.as_deref(), "document_id")?;
    let source_conversation_id = checked_id(query.source_conversation_id.as_deref(), "source_conversation_id")?;
    let created_after = query.created_after.as_deref().map(str::trim).filter(|value| !value.is_empty());
    if created_after.is_some_and(|value| value.len() > 64) {
        return Err(AppError::bad_request("created_after must be a timestamp"));
    }
    let filter = AskMemoryFilter {
        scope,
        document_id: document_id.as_deref(),
        statuses,
        query: q,
        source_conversation_id: source_conversation_id.as_deref(),
        created_after,
        limit,
    };
    let memories = deps.db.list_ask_memories(&filter)?;
    // 对话摘要（副对话的结论、生效的压缩摘要）：只在给了 q 时查，条数跟着 limit
    let summaries = match (query.include_summaries, q) {
        (Some(true), Some(q)) => Some(
            deps.db
                .search_ask_summaries(q, limit)?
                .into_iter()
                .map(|mut hit| {
                    hit.summary = truncate_chars(&hit.summary, MAX_SUMMARY_HIT_CHARS);
                    hit
                })
                .collect(),
        ),
        (Some(true), None) => Some(Vec::new()),
        _ => None,
    };
    Ok(AskMemoryListView { memories, summaries })
}

pub fn create_ask_memory_view(deps: &LibraryDeps<'_>, payload: &CreateAskMemoryInput) -> Result<AskMemoryCreatedView, AppError> {
    let scope = checked_scope(&payload.scope)?;
    let document_id = checked_id(payload.document_id.as_deref(), "document_id")?;
    match (scope, &document_id) {
        ("book", None) => return Err(AppError::bad_request("a book memory needs document_id")),
        ("user", Some(_)) => return Err(AppError::bad_request("a user memory has no document_id")),
        _ => {}
    }
    let origin = match payload.origin.as_deref().map(str::trim).unwrap_or("") {
        "" | "user" => "user",
        "agent" => "agent",
        _ => return Err(AppError::bad_request("origin must be user or agent")),
    };
    // 「让 AI 使用记忆」关着：agent 不能记（用户在记忆面板里自己加照常）
    if origin == "agent" && !deps.db.ask_settings()?.memory_enabled {
        return Err(AppError::conflict_because(
            "ask_memory_disabled",
            "the user turned off memory for the AI (ask settings memory_enabled = false); nothing was remembered",
        ));
    }
    if payload.source_page == Some(0) {
        return Err(AppError::bad_request("source_page must be at least 1"));
    }
    let new = NewAskMemory {
        scope: scope.to_string(),
        document_id: document_id.clone(),
        category: checked_category(payload.category.as_deref())?.unwrap_or_else(|| "other".to_string()),
        text: checked_text(&payload.text)?,
        origin: origin.to_string(),
        agent_id: checked_id(payload.agent_id.as_deref(), "agent_id")?,
        source_conversation_id: checked_id(payload.source_conversation_id.as_deref(), "source_conversation_id")?,
        source_message_id: checked_id(payload.source_message_id.as_deref(), "source_message_id")?,
        source_job_id: checked_id(payload.source_job_id.as_deref(), "source_job_id")?,
        source_page: payload.source_page,
        replaces: checked_id(payload.replaces.as_deref(), "replaces")?,
    };
    let limit = if scope == "user" { MAX_USER_MEMORIES } else { MAX_BOOK_MEMORIES };
    match deps.db.create_ask_memory(&new, limit)? {
        AskMemoryCreated::Created(memory) => Ok(AskMemoryCreatedView { memory, created: true, replaced: new.replaces }),
        AskMemoryCreated::Duplicate(memory) => Ok(AskMemoryCreatedView { memory, created: false, replaced: None }),
        AskMemoryCreated::DocumentMissing => {
            Err(AppError::not_found(format!("document not found: {}", document_id.unwrap_or_default())))
        }
        AskMemoryCreated::ReplacesMissing => Err(AppError::bad_request(format!(
            "replaces: memory not found or deleted: {}",
            new.replaces.unwrap_or_default()
        ))),
        AskMemoryCreated::LimitReached => Err(AppError::conflict_because_with(
            "ask_memory_limit",
            format!("already {limit} active {scope} memories; delete some or use replaces"),
            serde_json::json!({ "limit": limit, "scope": scope }),
        )),
    }
}

/// GET /ai/ask-settings：阅读页提问的设置（现在只有「让 AI 使用记忆」）。
pub fn get_ask_settings_view(deps: &LibraryDeps<'_>) -> Result<AskSettingsRecord, AppError> {
    Ok(deps.db.ask_settings()?)
}

/// PATCH /ai/ask-settings：给了的才改；什么都没给回现在的。
pub fn patch_ask_settings_view(deps: &LibraryDeps<'_>, payload: &PatchAskSettingsInput) -> Result<AskSettingsRecord, AppError> {
    match payload.memory_enabled {
        Some(enabled) => Ok(deps.db.set_ask_memory_enabled(enabled)?),
        None => Ok(deps.db.ask_settings()?),
    }
}

pub fn get_ask_memory_view(deps: &LibraryDeps<'_>, memory_id: &str) -> Result<AskMemoryRecord, AppError> {
    deps.db.get_ask_memory(memory_id)?.ok_or_else(|| not_found(memory_id))
}

pub fn patch_ask_memory_view(deps: &LibraryDeps<'_>, memory_id: &str, payload: &PatchAskMemoryInput) -> Result<AskMemoryRecord, AppError> {
    let text = payload.text.as_deref().map(checked_text).transpose()?;
    let category = checked_category(payload.category.as_deref())?;
    match deps.db.update_ask_memory(memory_id, text.as_deref(), category.as_deref())? {
        Some(memory) => Ok(memory),
        None if deps.db.get_ask_memory(memory_id)?.is_some() => {
            Err(AppError::conflict_because("ask_memory_deleted", format!("memory {memory_id} was deleted")))
        }
        None => Err(not_found(memory_id)),
    }
}

pub fn delete_ask_memory_view(deps: &LibraryDeps<'_>, memory_id: &str) -> Result<AskMemoryRecord, AppError> {
    deps.db.delete_ask_memory(memory_id)?.ok_or_else(|| not_found(memory_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_category_and_scope_are_checked() {
        assert_eq!(checked_text("  记一条 ").unwrap(), "记一条");
        assert!(checked_text(" ").is_err());
        assert!(checked_text(&"字".repeat(MAX_MEMORY_CHARS + 1)).is_err());
        assert_eq!(checked_category(Some("term")).unwrap().as_deref(), Some("term"));
        assert_eq!(checked_category(Some(" ")).unwrap(), None);
        assert!(checked_category(Some("mood")).is_err());
        assert!(checked_scope("global").is_err());
    }
}
