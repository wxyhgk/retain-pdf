//! AI conversation history (soft-anchor citations + message tree branches).

use crate::config::limits::MAX_CONVERSATION_LIMIT;
use crate::error::AppError;
use crate::models::api::{
    AppendMessageInput, ConversationDetailView, ConversationListView, ConversationMutationResult,
    ConversationRecord, CreateConversationInput, ForkConversationInput, ListConversationsQuery,
    MessageRecord, PatchConversationInput,
};
use crate::models::domain::build_job_id;

use super::LibraryDeps;

pub fn create_conversation(
    deps: &LibraryDeps<'_>,
    payload: &CreateConversationInput,
) -> Result<ConversationRecord, AppError> {
    let document_id = payload.document_id.trim();
    let document_id = if document_id.is_empty() {
        None
    } else {
        deps.db
            .get_document(document_id)
            .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
        Some(document_id)
    };
    Ok(deps.db.create_conversation(
        &format!("conv-{}", build_job_id()),
        payload.title.trim(),
        document_id,
    )?)
}

pub fn list_conversations(
    deps: &LibraryDeps<'_>,
    query: &ListConversationsQuery,
) -> Result<ConversationListView, AppError> {
    let limit = query.limit.clamp(1, MAX_CONVERSATION_LIMIT);
    let document_id = query.document_id.trim();
    let total = deps.db.count_conversations(if document_id.is_empty() {
        None
    } else {
        Some(document_id)
    })?;
    let conversations = if document_id.is_empty() {
        deps.db.list_conversations(limit, query.offset)?
    } else {
        deps.db
            .list_conversations_for_document(document_id, limit, query.offset)?
    };
    let returned = conversations.len() as u64;
    Ok(ConversationListView {
        conversations,
        total,
        limit,
        offset: query.offset,
        has_more: u64::from(query.offset).saturating_add(returned) < total,
    })
}

pub fn get_conversation(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<ConversationDetailView, AppError> {
    let conversation = deps
        .db
        .get_conversation(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;
    // 全量消息建树;上限 2000 防异常膨胀
    let messages = deps.db.list_messages(conversation_id, 2000)?;
    Ok(ConversationDetailView {
        conversation,
        messages,
    })
}

pub fn delete_conversation(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<ConversationMutationResult, AppError> {
    if !deps.db.delete_conversation(conversation_id)? {
        return Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        )));
    }
    Ok(ConversationMutationResult { deleted: true })
}

pub fn patch_conversation(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &PatchConversationInput,
) -> Result<ConversationRecord, AppError> {
    if deps.db.get_conversation(conversation_id)?.is_none() {
        return Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        )));
    }
    let head_id = payload.head_id.trim();
    if !head_id.is_empty() {
        // head 必须属于本会话
        if deps.db.get_message(conversation_id, head_id)?.is_none() {
            return Err(AppError::bad_request(format!(
                "head_id not in conversation: {head_id}"
            )));
        }
        deps.db
            .set_conversation_head(conversation_id, head_id)?
            .ok_or_else(|| {
                AppError::not_found(format!("conversation not found: {conversation_id}"))
            })?;
    }
    let title = payload.title.trim();
    if !title.is_empty() {
        deps.db
            .patch_conversation_title(conversation_id, title)?
            .ok_or_else(|| {
                AppError::not_found(format!("conversation not found: {conversation_id}"))
            })?;
    }
    deps.db
        .get_conversation(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))
}

pub fn fork_conversation(
    deps: &LibraryDeps<'_>,
    payload: &ForkConversationInput,
) -> Result<ConversationDetailView, AppError> {
    if payload.messages.is_empty() {
        return Err(AppError::bad_request("fork messages must not be empty"));
    }
    let document_id = payload.document_id.trim();
    let document_id_opt = if document_id.is_empty() {
        None
    } else {
        deps.db
            .get_document(document_id)
            .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
        Some(document_id)
    };
    let title = payload.title.trim();
    let title = if title.is_empty() {
        let first_user = payload.messages.iter().find(|m| m.role == "user");
        first_user
            .map(|m| m.content.chars().take(40).collect::<String>())
            .unwrap_or_else(|| "未命名对话".to_string())
    } else {
        let t: String = title.chars().take(80).collect();
        t
    };

    let conversation_id = format!("conv-{}", build_job_id());
    let mut tuples: Vec<(String, String, String, String, String, String, String)> =
        Vec::with_capacity(payload.messages.len());
    for msg in &payload.messages {
        if !matches!(msg.role.as_str(), "user" | "assistant") {
            return Err(AppError::bad_request("fork role must be user or assistant"));
        }
        if msg.content.trim().is_empty() {
            return Err(AppError::bad_request("fork content must not be empty"));
        }
        let message_id = {
            let c = msg.message_id.trim();
            if c.is_empty() {
                format!("msg-{}", build_job_id())
            } else if c.len() > 128 {
                return Err(AppError::bad_request("fork message_id too long"));
            } else {
                c.to_string()
            }
        };
        let citations = if msg.citations_json.trim().is_empty() {
            "[]".to_string()
        } else {
            msg.citations_json.clone()
        };
        let trace = if msg.tool_trace_json.trim().is_empty() {
            "[]".to_string()
        } else {
            msg.tool_trace_json.clone()
        };
        tuples.push((
            message_id,
            msg.role.clone(),
            msg.content.clone(),
            msg.parent_id.clone(),
            citations,
            trace,
            msg.model.clone(),
        ));
    }

    let (conversation, messages) = deps
        .db
        .fork_conversation(&conversation_id, &title, document_id_opt, &tuples)
        .map_err(|e| {
            let msg = format!("{e}");
            if msg.contains("parent_id not in path")
                || msg.contains("UNIQUE")
                || msg.contains("PRIMARY")
            {
                AppError::bad_request(msg)
            } else {
                AppError::internal(msg)
            }
        })?;
    Ok(ConversationDetailView {
        conversation,
        messages,
    })
}

pub fn append_message(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: AppendMessageInput,
) -> Result<MessageRecord, AppError> {
    if !matches!(payload.role.as_str(), "user" | "assistant") {
        return Err(AppError::bad_request("role must be user or assistant"));
    }
    if payload.content.trim().is_empty() {
        return Err(AppError::bad_request("content must not be empty"));
    }
    let conversation = deps
        .db
        .get_conversation(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;

    let mut parent_id = payload.parent_id.trim().to_string();
    if parent_id.is_empty() {
        // 未指定 parent: 挂到当前 head(线性续写);无 head 则为根
        parent_id = resolve_head_id(deps, conversation_id, &conversation)?;
    } else if deps.db.get_message(conversation_id, &parent_id)?.is_none() {
        return Err(AppError::bad_request(format!(
            "parent_id not in conversation: {parent_id}"
        )));
    }

    let message_id = {
        let client = payload.message_id.trim();
        if client.is_empty() {
            format!("msg-{}", build_job_id())
        } else if client.len() > 128 {
            return Err(AppError::bad_request("message_id too long"));
        } else {
            client.to_string()
        }
    };

    let citations = if payload.citations_json.trim().is_empty() {
        "[]".to_string()
    } else {
        payload.citations_json
    };
    let trace = if payload.tool_trace_json.trim().is_empty() {
        "[]".to_string()
    } else {
        payload.tool_trace_json
    };
    Ok(deps.db.append_message(
        conversation_id,
        &message_id,
        &payload.role,
        &payload.content,
        &citations,
        &trace,
        &payload.model,
        &parent_id,
        payload.set_head,
    )?)
}

fn resolve_head_id(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    conversation: &ConversationRecord,
) -> Result<String, AppError> {
    let head = conversation.head_id.trim();
    if !head.is_empty() {
        return Ok(head.to_string());
    }
    // 旧数据无 head_id:取 seq 最大的一条作为当前叶
    let all = deps.db.list_messages(conversation_id, 2000)?;
    Ok(all.last().map(|m| m.message_id.clone()).unwrap_or_default())
}
