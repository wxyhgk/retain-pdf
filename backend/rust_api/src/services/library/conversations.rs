//! AI conversation history (soft-anchor citations + message tree branches).

use crate::error::AppError;
use crate::models::api::{
    AppendMessageInput, ConversationDetailView, ConversationListView, ConversationMutationResult,
    ConversationRecord, CreateConversationInput, ListConversationsQuery, MessageRecord,
    PatchConversationInput,
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
    let limit = query.limit.clamp(1, 200);
    let document_id = query.document_id.trim();
    let conversations = if document_id.is_empty() {
        deps.db.list_conversations(limit, query.offset)?
    } else {
        deps.db
            .list_conversations_for_document(document_id, limit, query.offset)?
    };
    Ok(ConversationListView { conversations })
}

pub fn get_conversation(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<ConversationDetailView, AppError> {
    let conversation = deps
        .db
        .get_conversation(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;
    // Xây dựng tin nhắn đầy đủ;Giới hạn trên 2000 Chống giãn nở bất thường
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
        // head Phải thuộc về buổi học này
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
        // Chưa ghi rõ parent: Giữ nguyên trạng thái hiện tại head(Tiếp tục tuyến tính);Không có head sau đó root
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
    // Dữ liệu cũ không có sẵn head_id:lấy seq Cái lớn nhất như lá hiện tại
    let all = deps.db.list_messages(conversation_id, 2000)?;
    Ok(all
        .last()
        .map(|m| m.message_id.clone())
        .unwrap_or_default())
}

/// Từ head dọc theo parent Chuỗi backtracking dẫn đến các đường tuyến tính có thể nhìn thấy(Cột→lá),cung cấp LLM Bối cảnh。
pub fn visible_path_messages(
    messages: &[MessageRecord],
    head_id: &str,
) -> Vec<MessageRecord> {
    if messages.is_empty() {
        return Vec::new();
    }
    let by_id: std::collections::HashMap<&str, &MessageRecord> = messages
        .iter()
        .map(|m| (m.message_id.as_str(), m))
        .collect();
    let start = {
        let h = head_id.trim();
        if !h.is_empty() {
            by_id.get(h).copied()
        } else {
            None
        }
        .or_else(|| messages.last())
    };
    let Some(start) = start else {
        return Vec::new();
    };
    let mut chain = Vec::new();
    let mut cur = Some(start);
    let mut guard = 0usize;
    while let Some(msg) = cur {
        chain.push(msg.clone());
        guard += 1;
        if guard > messages.len() + 2 {
            break;
        }
        let pid = msg.parent_id.trim();
        cur = if pid.is_empty() {
            None
        } else {
            by_id.get(pid).copied()
        };
    }
    chain.reverse();
    chain
}
