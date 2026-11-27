//! 阅读页提问的主对话、副对话和记忆（契约 `ask-conversations.v1`，2026-11-26，数据库 v40）：走真接口，返回对着契约核对键集合；
//! 请求类型和契约字段一一对上；只追加和幂等号、副对话结束回填卡片、上下文、书上问过的地方、记忆的替代和撤销、AI 专用密钥能调哪几条。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::job_view_contract::{assert_definition, assert_exact_object_keys, contract};
use super::jobs_common::{read_json, test_state};
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::{seed_document, send};
use crate::app::{build_app, build_state};
use crate::models::api::{
    AppendAskMessagesInput, AskContextQuery, AskConversationMessageInput, AskSelectionInput, CloseAskConversationInput, CreateAskMemoryInput, CreateAskSideConversationInput,
    ListAskConversationsQuery, ListAskMemoriesQuery, ListAskMessagesQuery, PatchAskConversationInput, PatchAskMemoryInput,
    PatchAskSettingsInput, AskModelConnectionInput, CreateAskCompactionInput,
};
use crate::test_support::config::TestDirs;

const CONTRACT: &str = "ask-conversations.v1.schema.json";

async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

fn assert_message(value: &Value, contract: &Value, path: &str) {
    assert_exact_object_keys(value, contract, "AskConversationMessageRecord", path);
}

fn assert_memory(value: &Value, contract: &Value, path: &str) {
    assert_exact_object_keys(value, contract, "AskMemoryRecord", path);
}

#[test]
fn request_bodies_and_queries_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<AppendAskMessagesInput>(&contract, "AppendAskMessagesInput");
    assert_request_fields_match::<AskConversationMessageInput>(&contract, "AskConversationMessageInput");
    assert_request_fields_match::<AskSelectionInput>(&contract, "AskSelectionInput");
    assert_request_fields_match::<CreateAskSideConversationInput>(&contract, "CreateAskSideConversationInput");
    assert_request_fields_match::<PatchAskConversationInput>(&contract, "PatchAskConversationInput");
    assert_request_fields_match::<CloseAskConversationInput>(&contract, "CloseAskConversationInput");
    assert_request_fields_match::<ListAskConversationsQuery>(&contract, "ListAskConversationsQuery");
    assert_request_fields_match::<ListAskMessagesQuery>(&contract, "ListAskMessagesQuery");
    assert_request_fields_match::<AskContextQuery>(&contract, "AskContextQuery");
    assert_request_fields_match::<ListAskMemoriesQuery>(&contract, "ListAskMemoriesQuery");
    assert_request_fields_match::<CreateAskMemoryInput>(&contract, "CreateAskMemoryInput");
    assert_request_fields_match::<PatchAskMemoryInput>(&contract, "PatchAskMemoryInput");
    assert_request_fields_match::<PatchAskSettingsInput>(&contract, "PatchAskSettingsInput");
    assert_request_fields_match::<AskModelConnectionInput>(&contract, "AskModelConnectionInput");
    assert_request_fields_match::<CreateAskCompactionInput>(&contract, "CreateAskCompactionInput");
}

/// 第二期（2026-11-26）：压缩接口。没东西可压时 409、不调模型；列压缩摘要；消息分页带压缩点（空的）；追加的返回带 compaction_due。
/// 真压一次要模型，走书库包里用假的总结函数的测试（`ask_compactions.rs`）。
#[tokio::test]
async fn compactions_refuse_when_nothing_to_compact_and_pages_carry_the_points() {
    let state = test_state("ask-conversations-compactions");
    let contract = contract(CONTRACT);
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let id = main["conversation_id"].as_str().unwrap().to_string();
    let appended = ok_data(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{id}/messages"),
        Some(json!({"messages": [{"role": "user", "text": "问"}, {"role": "assistant", "text": "答"}]})),
    )
    .await;
    assert_definition(&appended, &contract, "AppendAskMessagesView", "appended");
    assert_eq!(appended["compaction_due"], false);
    let connection = json!({"model": "m", "credential_ref": "cred-missing"});
    let (status, payload) =
        send(&state, "POST", &format!("/api/v1/ai/ask-conversations/{id}/compactions"), Some(json!({"connection": connection}))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_compaction_nothing");
    let (status, _) = send(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{id}/compactions"),
        Some(json!({"connection": connection, "max_chars": 5})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(&state, "POST", "/api/v1/ai/ask-conversations/conv-missing/compactions", Some(json!({"connection": connection}))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let listed = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/compactions"), None).await;
    assert_definition(&listed, &contract, "AskCompactionListView", "listed");
    assert_eq!(listed["compactions"], json!([]));
    let page = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/messages"), None).await;
    assert_definition(&page, &contract, "AskMessagePageView", "page");
    assert_eq!(page["compactions"], json!([]));
    let context = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/context"), None).await;
    assert_definition(&context, &contract, "AskContextView", "context");
    assert!(context["summary"].is_null() && context["summary_covers_to_seq"].is_null());
}

/// 改后重问（2026-11-26 用户定「后面的作废，从这里重问」）：从一条问起作废，上下文不带作废的，改后的问带 edited_from 追加。
#[tokio::test]
async fn editing_a_question_supersedes_it_and_what_followed() {
    let state = test_state("ask-conversations-edit");
    let contract = contract(CONTRACT);
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let id = main["conversation_id"].as_str().unwrap().to_string();
    let mut asked = Vec::new();
    for turn in ["一", "二"] {
        let appended = ok_data(
            &state,
            "POST",
            &format!("/api/v1/ai/ask-conversations/{id}/messages"),
            Some(json!({"messages": [{"role": "user", "text": format!("问{turn}")}, {"role": "assistant", "text": format!("答{turn}")}]})),
        )
        .await;
        asked.push(appended["messages"][0]["message_id"].as_str().unwrap().to_string());
    }
    let answer_two = {
        let page = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/messages"), None).await;
        page["messages"][3]["message_id"].as_str().unwrap().to_string()
    };
    let supersede = |message_id: &str| format!("/api/v1/ai/ask-conversations/{id}/messages/{message_id}/supersede");
    let (status, _) = send(&state, "POST", &supersede(&answer_two), None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "only a question can be edited");
    let (status, _) = send(&state, "POST", &supersede("msg-missing"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let done = ok_data(&state, "POST", &supersede(&asked[1]), None).await;
    assert_definition(&done, &contract, "SupersedeAskMessagesView", "superseded");
    assert_eq!(done["superseded_message_ids"], json!([asked[1], answer_two]));
    let (status, payload) = send(&state, "POST", &supersede(&asked[1]), None).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(payload["error"]["details"]["reason"], "ask_message_superseded");

    let context = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/context"), None).await;
    assert_eq!(context["messages"].as_array().unwrap().len(), 2);
    assert!(!context["text"].as_str().unwrap().contains("问二"));

    let (status, _) = send(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{id}/messages"),
        Some(json!({"messages": [{"role": "user", "text": "问二（改）", "edited_from": asked[0]}]})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "edited_from must point at a superseded question");
    let appended = ok_data(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{id}/messages"),
        Some(json!({"messages": [{"role": "user", "text": "问二（改）", "edited_from": asked[1]}, {"role": "assistant", "text": "新答"}]})),
    )
    .await;
    assert_definition(&appended, &contract, "AppendAskMessagesView", "appended");
    assert_eq!(appended["messages"][0]["edited_from"], asked[1].as_str());
    let page = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{id}/messages"), None).await;
    assert_definition(&page, &contract, "AskMessagePageView", "page");
    let superseded: Vec<bool> = page["messages"].as_array().unwrap().iter().map(|message| !message["superseded_at"].is_null()).collect();
    assert_eq!(superseded, vec![false, false, true, true, false, false]);
}

/// 删对话：这个对话和它的副对话里消息记着的 agent 会话（v44 `session_id`），没有别处在用的就删掉 pi 的会话文件；
/// 还有别的对话记着同一个会话的留着（2026-11-26，前端真机测出来删了对话 pi 的会话文件还在）。
#[tokio::test]
async fn deleting_a_conversation_removes_its_pi_session_files() {
    let state = test_state("ask-conversations-pi-sessions");
    let sessions = state.config.data_root.join("ask-pi").join("sessions");
    std::fs::create_dir_all(&sessions).unwrap();
    let write = |session_id: &str| {
        let path = sessions.join(format!("2026-11-26T08-00-00-000Z_{session_id}.jsonl"));
        let header = json!({ "type": "session", "version": 3, "id": session_id, "timestamp": "2026-11-26T08:00:00.000Z", "cwd": "/books/x" });
        std::fs::write(&path, format!("{header}\n")).unwrap();
        path
    };
    let (main_s, side_s, shared_s) = ("019ab000-0000-7000-8000-00000000000a", "019ab000-0000-7000-8000-00000000000b", "019ab000-0000-7000-8000-00000000000c");
    let files = [write(main_s), write(side_s), write(shared_s)];

    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let main_id = main["conversation_id"].as_str().unwrap().to_string();
    let turn = |session_id: &str| json!({"messages": [
        {"role": "user", "text": "问", "session_id": session_id}, {"role": "assistant", "text": "答", "session_id": session_id}]});
    let appended = ok_data(&state, "POST", &format!("/api/v1/ai/ask-conversations/{main_id}/messages"), Some(turn(main_s))).await;
    assert_eq!(appended["messages"][1]["session_id"], main_s);
    ok_data(&state, "POST", &format!("/api/v1/ai/ask-conversations/{main_id}/messages"), Some(turn(shared_s))).await;
    let side = ok_data(&state, "POST", "/api/v1/ai/ask-conversations", Some(json!({ "parent_id": main_id }))).await;
    let side_id = side["conversation_id"].as_str().unwrap().to_string();
    ok_data(&state, "POST", &format!("/api/v1/ai/ask-conversations/{side_id}/messages"), Some(turn(side_s))).await;
    // 另一个主对话也记着 shared_s（比如同一个 pi 会话里换过对话）
    ok_data(&state, "PATCH", &format!("/api/v1/ai/ask-conversations/{main_id}"), Some(json!({ "status": "archived" }))).await;
    let other = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let other_id = other["conversation_id"].as_str().unwrap().to_string();
    ok_data(&state, "POST", &format!("/api/v1/ai/ask-conversations/{other_id}/messages"), Some(turn(shared_s))).await;

    ok_data(&state, "DELETE", &format!("/api/v1/ai/ask-conversations/{main_id}"), None).await;
    assert!(!files[0].exists(), "主对话的 pi 会话文件该删");
    assert!(!files[1].exists(), "副对话跟着删，它的 pi 会话文件也该删");
    assert!(files[2].exists(), "别的对话还记着这个会话，不能删");
}

/// search_memories 也查对话摘要（第二期）：`include_summaries=true` 时 `summaries` 里有副对话的结论；不给就没有这个字段。
#[tokio::test]
async fn memory_search_can_include_conversation_summaries() {
    let state = test_state("ask-memories-summaries");
    let contract = contract(CONTRACT);
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let main_id = main["conversation_id"].as_str().unwrap().to_string();
    let side = ok_data(&state, "POST", "/api/v1/ai/ask-conversations", Some(json!({ "parent_id": main_id }))).await;
    let side_id = side["conversation_id"].as_str().unwrap().to_string();
    ok_data(&state, "POST", &format!("/api/v1/ai/ask-conversations/{side_id}/close"), Some(json!({"summary": "结论：交换项只在同自旋之间"}))).await;

    let found = ok_data(&state, "GET", "/api/v1/ai/memories?q=%E4%BA%A4%E6%8D%A2%E9%A1%B9&include_summaries=true", None).await;
    assert_definition(&found, &contract, "AskMemoryListView", "found");
    assert_eq!(found["summaries"][0]["kind"], "side");
    assert_eq!(found["summaries"][0]["conversation_id"], side_id.as_str());
    assert!(found["summaries"][0]["compaction_id"].is_null());
    let plain = ok_data(&state, "GET", "/api/v1/ai/memories?q=%E4%BA%A4%E6%8D%A2%E9%A1%B9", None).await;
    assert!(plain.get("summaries").is_none());
    let no_query = ok_data(&state, "GET", "/api/v1/ai/memories?include_summaries=true", None).await;
    assert_eq!(no_query["summaries"], json!([]));
}

/// 2026-11-26 用户定：主对话只能先归档再删；副对话不受限制。
#[tokio::test]
async fn the_open_main_conversation_cannot_be_deleted_until_archived() {
    let state = test_state("ask-conversations-delete-main");
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let main_id = main["conversation_id"].as_str().unwrap().to_string();
    let side = ok_data(&state, "POST", "/api/v1/ai/ask-conversations", Some(json!({ "parent_id": main_id }))).await;
    let side_id = side["conversation_id"].as_str().unwrap().to_string();

    let (status, payload) = send(&state, "DELETE", &format!("/api/v1/ai/ask-conversations/{main_id}"), None).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_main_conversation_open");
    // 开着的副对话照删
    ok_data(&state, "DELETE", &format!("/api/v1/ai/ask-conversations/{side_id}"), None).await;
    ok_data(&state, "PATCH", &format!("/api/v1/ai/ask-conversations/{main_id}"), Some(json!({ "status": "archived" }))).await;
    let deleted = ok_data(&state, "DELETE", &format!("/api/v1/ai/ask-conversations/{main_id}"), None).await;
    assert_eq!(deleted["deleted"], true);
}

/// 「让 AI 使用记忆」总开关：默认开；关掉后上下文不带记忆、agent 记不了，用户自己加、列表照常，已经记下的都留着。
#[tokio::test]
async fn the_memory_switch_hides_memories_from_the_ai_and_stops_agent_writes() {
    let state = test_state("ask-settings");
    let contract = contract(CONTRACT);
    let settings = ok_data(&state, "GET", "/api/v1/ai/ask-settings", None).await;
    assert_definition(&settings, &contract, "AskSettingsRecord", "settings");
    assert_exact_object_keys(&settings, &contract, "AskSettingsRecord", "settings");
    assert_eq!((settings["memory_enabled"].as_bool(), settings["updated_at"].clone()), (Some(true), Value::Null));
    ok_data(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "text": "用户要先看结论", "origin": "agent" }))).await;
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let context_uri = format!("/api/v1/ai/ask-conversations/{}/context", main["conversation_id"].as_str().unwrap());
    let on = ok_data(&state, "GET", &context_uri, None).await;
    assert_eq!((on["memory_enabled"].as_bool(), on["memories"]["user"].as_array().unwrap().len()), (Some(true), 1));

    let off = ok_data(&state, "PATCH", "/api/v1/ai/ask-settings", Some(json!({ "memory_enabled": false }))).await;
    assert_eq!(off["memory_enabled"], false);
    assert!(off["updated_at"].is_string());
    let context = ok_data(&state, "GET", &context_uri, None).await;
    assert_eq!(context["memory_enabled"], false);
    assert_eq!((context["memories"]["user"].as_array().unwrap().len(), context["memory_text"].as_str()), (0, Some("")));
    let (status, payload) =
        send(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "text": "用户是化学专业的", "origin": "agent" }))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_memory_disabled");
    // 用户自己加照常；已经记下的都在
    ok_data(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "text": "用户是化学专业的" }))).await;
    assert_eq!(ok_data(&state, "GET", "/api/v1/ai/memories", None).await["memories"].as_array().unwrap().len(), 2);
    // 什么都不给：回现在的；不认识的字段 400
    assert_eq!(ok_data(&state, "PATCH", "/api/v1/ai/ask-settings", Some(json!({}))).await["memory_enabled"], false);
    let (status, _) = send(&state, "PATCH", "/api/v1/ai/ask-settings", Some(json!({ "memory": false }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(ok_data(&state, "PATCH", "/api/v1/ai/ask-settings", Some(json!({ "memory_enabled": true }))).await["memory_enabled"], true);
}

#[tokio::test]
async fn main_conversation_messages_side_conversation_and_context() {
    let state = test_state("ask-conversations");
    let contract = contract(CONTRACT);
    let book = seed_document(&state, b"ask-conversations-a");

    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    assert_definition(&main, &contract, "AskConversationRecord", "main");
    assert_exact_object_keys(&main, &contract, "AskConversationRecord", "main");
    let main_id = main["conversation_id"].as_str().unwrap().to_string();
    assert!(main_id.starts_with("conv-"), "{main_id}");
    assert_eq!(ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await["conversation_id"], main_id.as_str());

    // 追加一轮：问带结构化出处（书从出处里取），答带用量
    let selection = json!({
        "document_id": book, "job_id": "job-1", "translation_version": "tv-1", "pane": "translated", "page": 56,
        "item_ids": ["p056-b0003", "p056-b0003"], "selected_text": "选中的一句", "section": "2 方法", "prefix": null
    });
    let messages_uri = format!("/api/v1/ai/ask-conversations/{main_id}/messages");
    let appended = ok_data(
        &state,
        "POST",
        &messages_uri,
        Some(json!({ "messages": [
            { "role": "user", "text": "这句是什么意思？", "agent_id": "retainpdf", "selection": selection, "client_message_id": "c-1" },
            { "role": "assistant", "text": "意思是……", "thought": "先看上下文", "usage": { "model": "claude-haiku-5-5" } }
        ]})),
    )
    .await;
    assert_definition(&appended, &contract, "AppendAskMessagesView", "appended");
    let asked = &appended["messages"][0];
    assert_message(asked, &contract, "appended.messages[0]");
    assert_eq!((asked["seq"].as_i64(), asked["document_id"].as_str(), asked["page"].as_i64()), (Some(1), Some(book.as_str()), Some(56)));
    assert_eq!((asked["job_id"].as_str(), asked["version_id"].as_str(), asked["pane"].as_str()), (Some("job-1"), Some("tv-1"), Some("translated")));
    assert_eq!(asked["selection"]["item_ids"], json!(["p056-b0003"]));
    assert!(asked["selection"].get("prefix").is_none(), "{asked}");
    assert_eq!(appended["conversation"]["message_count"], 2);
    // 网络重试：幂等号一样，回原来那条
    let retried = ok_data(
        &state,
        "POST",
        &messages_uri,
        Some(json!({ "messages": [{ "role": "user", "text": "这句是什么意思？", "client_message_id": "c-1" }] })),
    )
    .await;
    assert_eq!(retried["messages"][0]["message_id"], asked["message_id"]);

    // 分页
    let page = ok_data(&state, "GET", &format!("{messages_uri}?limit=1"), None).await;
    assert_definition(&page, &contract, "AskMessagePageView", "page");
    assert_eq!((page["messages"][0]["seq"].as_i64(), page["has_more"].as_bool()), (Some(2), Some(true)));
    let earlier = ok_data(&state, "GET", &format!("{messages_uri}?limit=1&before_seq=2"), None).await;
    assert_eq!((earlier["messages"][0]["seq"].as_i64(), earlier["has_more"].as_bool()), (Some(1), Some(false)));

    // 书上问过的地方
    let marks = ok_data(&state, "GET", &format!("/api/v1/documents/{book}/ask-messages"), None).await;
    assert_definition(&marks, &contract, "DocumentAskMessagesView", "marks");
    assert_eq!(marks["messages"].as_array().unwrap().len(), 1);

    // 副对话：从回答分出来，结束时结论回到主对话
    let answer_id = appended["messages"][1]["message_id"].as_str().unwrap();
    let side = ok_data(
        &state,
        "POST",
        "/api/v1/ai/ask-conversations",
        Some(json!({ "parent_id": main_id, "forked_from_message_id": answer_id, "title": "  深挖\n这句 ", "document_id": book })),
    )
    .await;
    assert_exact_object_keys(&side, &contract, "AskConversationRecord", "side");
    assert_eq!((side["kind"].as_str(), side["title"].as_str()), (Some("side"), Some("深挖 这句")));
    let side_id = side["conversation_id"].as_str().unwrap().to_string();
    ok_data(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{side_id}/messages"),
        Some(json!({ "messages": [{ "role": "user", "text": "再细说" }, { "role": "assistant", "text": "细说……" }] })),
    )
    .await;
    let context = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{side_id}/context?recent_turns=2"), None).await;
    assert_definition(&context, &contract, "AskContextView", "side context");
    assert_exact_object_keys(&context, &contract, "AskContextView", "side context");
    assert_eq!(context["parent"]["messages"].as_array().unwrap().len(), 2, "{context}");
    assert!(context["text"].as_str().unwrap().contains("【主对话里分出这个话题之前的几轮】"), "{context}");

    let closed = ok_data(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{side_id}/close"),
        Some(json!({ "summary": "结论：这句说的是能量守恒" })),
    )
    .await;
    assert_definition(&closed, &contract, "CloseAskConversationView", "closed");
    assert_eq!((closed["conversation"]["status"].as_str(), closed["card"]["role"].as_str()), (Some("closed"), Some("side_summary")));
    assert_eq!((closed["card"]["conversation_id"].as_str(), closed["card"]["seq"].as_i64()), (Some(main_id.as_str()), Some(3)));
    let (status, payload) = send(
        &state,
        "POST",
        &format!("/api/v1/ai/ask-conversations/{side_id}/messages"),
        Some(json!({ "messages": [{ "role": "user", "text": "还能问吗" }] })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_conversation_not_open");

    let list = ok_data(&state, "GET", "/api/v1/ai/ask-conversations", None).await;
    assert_definition(&list, &contract, "AskConversationListView", "list");
    assert_eq!(list["conversations"][0]["conversation_id"], main_id.as_str(), "主对话在前");
    let sides = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations?kind=side&parent_id={main_id}"), None).await;
    assert_eq!(sides["conversations"].as_array().unwrap().len(), 1);

    // 主对话的上下文：记忆 + 最近几轮 + 拼好的文字
    ok_data(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "category": "style", "text": "用户要先看结论" }))).await;
    ok_data(
        &state,
        "POST",
        "/api/v1/ai/memories",
        Some(json!({ "scope": "book", "document_id": book, "category": "term", "text": "energy 译成能量" })),
    )
    .await;
    let context = ok_data(&state, "GET", &format!("/api/v1/ai/ask-conversations/{main_id}/context?document_id={book}"), None).await;
    assert_eq!(context["parent"], Value::Null);
    assert_eq!(context["messages"].as_array().unwrap().len(), 3);
    assert_eq!((context["memories"]["user"].as_array().unwrap().len(), context["memories"]["book"].as_array().unwrap().len()), (1, 1));
    let memory_text = context["memory_text"].as_str().unwrap();
    assert!(memory_text.contains("回答风格：用户要先看结论") && memory_text.contains("术语：energy 译成能量"), "{memory_text}");
    let text = context["text"].as_str().unwrap();
    assert!(text.starts_with(memory_text) && text.contains("我（第 56 页）：这句是什么意思？"), "{text}");

    // 归档主对话：再取是新的；旧的再开 409
    ok_data(&state, "PATCH", &format!("/api/v1/ai/ask-conversations/{main_id}"), Some(json!({ "status": "archived" }))).await;
    let next = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    assert_ne!(next["conversation_id"], main_id.as_str());
    let (status, payload) =
        send(&state, "PATCH", &format!("/api/v1/ai/ask-conversations/{main_id}"), Some(json!({ "status": "open" }))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_main_conversation_open");

    // 删对话：记忆留着
    let deleted = ok_data(&state, "DELETE", &format!("/api/v1/ai/ask-conversations/{main_id}"), None).await;
    assert_definition(&deleted, &contract, "AskConversationDeleteResultView", "deleted");
    let (status, _) = send(&state, "GET", &format!("/api/v1/ai/ask-conversations/{main_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "GET", &format!("/api/v1/ai/ask-conversations/{side_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "副对话跟着删");
    let memories = ok_data(&state, "GET", "/api/v1/ai/memories", None).await;
    assert_eq!(memories["memories"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn bad_requests_are_refused() {
    let state = test_state("ask-conversations-bad");
    let main = ok_data(&state, "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let main_id = main["conversation_id"].as_str().unwrap().to_string();
    let messages_uri = format!("/api/v1/ai/ask-conversations/{main_id}/messages");
    for (what, body) in [
        ("empty", json!({ "messages": [] })),
        ("unknown field", json!({ "messages": [{ "role": "user", "text": "x", "extra": 1 }] })),
        ("summary role", json!({ "messages": [{ "role": "side_summary", "text": "x" }] })),
        ("page 0", json!({ "messages": [{ "role": "user", "text": "x", "selection": { "page": 0 } }] })),
        ("unknown selection field", json!({ "messages": [{ "role": "user", "text": "x", "selection": { "page": 1, "itemId": "x" } }] })),
        ("bad pane", json!({ "messages": [{ "role": "user", "text": "x", "selection": { "page": 1, "pane": "left" } }] })),
        ("bad job", json!({ "messages": [{ "role": "user", "text": "x", "selection": { "page": 1, "job_id": "a/b" } }] })),
        ("books differ", json!({ "messages": [{ "role": "user", "text": "x", "document_id": "a", "selection": { "page": 1, "document_id": "b" } }] })),
        ("usage not object", json!({ "messages": [{ "role": "assistant", "text": "x", "usage": [1] }] })),
    ] {
        let (status, payload) = send(&state, "POST", &messages_uri, Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{what}: {payload}");
    }
    let (status, _) = send(&state, "POST", "/api/v1/ai/ask-conversations/conv-missing/messages", Some(json!({ "messages": [{ "role": "user", "text": "x" }] }))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "POST", "/api/v1/ai/ask-conversations", Some(json!({ "parent_id": "conv-missing" }))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "POST", &format!("/api/v1/ai/ask-conversations/{main_id}/close"), Some(json!({}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "主对话不能结束");
    let (status, _) = send(&state, "GET", &format!("/api/v1/ai/ask-conversations/{main_id}/context?recent_turns=0"), None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(&state, "GET", "/api/v1/ai/ask-conversations?kind=other", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(&state, "GET", "/api/v1/documents/no-such-book/ask-messages", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn memories_are_created_replaced_searched_edited_and_undone() {
    let state = test_state("ask-memories");
    let contract = contract(CONTRACT);
    let book = seed_document(&state, b"ask-memories-a");

    let first = ok_data(
        &state,
        "POST",
        "/api/v1/ai/memories",
        Some(json!({ "scope": "user", "category": "style", "text": " 用户要先看推导 ", "origin": "agent", "agent_id": "retainpdf",
                     "source_conversation_id": "conv-gone", "source_page": 3 })),
    )
    .await;
    assert_definition(&first, &contract, "AskMemoryCreatedView", "created");
    assert_memory(&first["memory"], &contract, "created.memory");
    assert_eq!((first["created"].as_bool(), first["memory"]["text"].as_str()), (Some(true), Some("用户要先看推导")));
    assert_eq!(first["memory"]["source_conversation_id"], Value::Null, "不在库里的出处当没给");
    let first_id = first["memory"]["memory_id"].as_str().unwrap().to_string();
    // 一模一样的：回原来那条
    let again = ok_data(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "text": "用户要先看推导" }))).await;
    assert_eq!((again["created"].as_bool(), again["memory"]["memory_id"].as_str()), (Some(false), Some(first_id.as_str())));
    // 替代
    let newer = ok_data(
        &state,
        "POST",
        "/api/v1/ai/memories",
        Some(json!({ "scope": "user", "category": "style", "text": "用户要先看结论", "replaces": first_id })),
    )
    .await;
    assert_eq!(newer["replaced"], first_id.as_str());
    let newer_id = newer["memory"]["memory_id"].as_str().unwrap().to_string();
    let superseded = ok_data(&state, "GET", "/api/v1/ai/memories?status=superseded", None).await;
    assert_eq!(superseded["memories"][0]["superseded_by"], newer_id.as_str());

    // 书层；检索
    ok_data(
        &state,
        "POST",
        "/api/v1/ai/memories",
        Some(json!({ "scope": "book", "document_id": book, "category": "term", "text": "Hamiltonian 定译为哈密顿量" })),
    )
    .await;
    let found = ok_data(&state, "GET", "/api/v1/ai/memories?q=hamiltonian", None).await;
    assert_definition(&found, &contract, "AskMemoryListView", "found");
    assert_eq!(found["memories"].as_array().unwrap().len(), 1);
    let book_layer = ok_data(&state, "GET", &format!("/api/v1/ai/memories?scope=book&document_id={book}"), None).await;
    assert_eq!(book_layer["memories"].as_array().unwrap().len(), 1);

    // 改、撤销（旧的恢复）
    let edited = ok_data(&state, "PATCH", &format!("/api/v1/ai/memories/{newer_id}"), Some(json!({ "text": "用户要先看结论，再看推导" }))).await;
    assert_memory(&edited, &contract, "edited");
    let undone = ok_data(&state, "DELETE", &format!("/api/v1/ai/memories/{newer_id}"), None).await;
    assert_eq!(undone["status"], "deleted");
    let active = ok_data(&state, "GET", "/api/v1/ai/memories?scope=user", None).await;
    assert_eq!(active["memories"][0]["memory_id"], first_id.as_str());
    let (status, payload) = send(&state, "PATCH", &format!("/api/v1/ai/memories/{newer_id}"), Some(json!({ "text": "x" }))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_memory_deleted");

    for (what, body) in [
        ("book without document", json!({ "scope": "book", "text": "x" })),
        ("user with document", json!({ "scope": "user", "document_id": book, "text": "x" })),
        ("bad scope", json!({ "scope": "global", "text": "x" })),
        ("bad category", json!({ "scope": "user", "category": "mood", "text": "x" })),
        ("too long", json!({ "scope": "user", "text": "字".repeat(501) })),
        ("blank", json!({ "scope": "user", "text": "  " })),
        ("replaces missing", json!({ "scope": "user", "text": "y", "replaces": "mem-missing" })),
    ] {
        let (status, payload) = send(&state, "POST", "/api/v1/ai/memories", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{what}: {payload}");
    }
    let (status, _) =
        send(&state, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "book", "document_id": "no-such-book", "text": "x" }))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "DELETE", "/api/v1/ai/memories/mem-missing", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

const AGENT_KEY: &str = "agent-test-key";

async fn call(state: &crate::AppState, key: &str, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri).header("X-API-Key", key);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    let request = builder.body(body.map(|value| Body::from(value.to_string())).unwrap_or_else(Body::empty)).unwrap();
    let response = build_app(state.clone()).oneshot(request).await.unwrap();
    let status = response.status();
    (status, read_json(response).await)
}

/// 自带 agent 拿 AI 专用密钥：只能取上下文、列查和记记忆；改、删记忆和动对话是用户的事。
#[tokio::test]
async fn agent_key_reads_context_and_writes_memories_only() {
    let dirs = TestDirs::create(&format!("rust-api-ask-agent-key-{}", fastrand::u64(..)));
    let mut config = dirs.config();
    config.agent_keys = [AGENT_KEY.to_string()].into_iter().collect();
    let state = build_state(Arc::new(config)).unwrap();
    let (_, main) = call(&state, "test-key", "POST", "/api/v1/ai/ask-conversations/main", None).await;
    let main_id = main["data"]["conversation_id"].as_str().unwrap().to_string();

    let (status, body) = call(&state, AGENT_KEY, "GET", &format!("/api/v1/ai/ask-conversations/{main_id}/context"), None).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = call(&state, AGENT_KEY, "GET", "/api/v1/ai/ask-settings", None).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) =
        call(&state, AGENT_KEY, "POST", "/api/v1/ai/memories", Some(json!({ "scope": "user", "text": "用户是化学专业的", "origin": "agent" })))
            .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let memory_id = body["data"]["memory"]["memory_id"].as_str().unwrap().to_string();
    let (status, body) = call(&state, AGENT_KEY, "GET", "/api/v1/ai/memories?q=化学", None).await;
    assert_eq!((status, body["data"]["memories"].as_array().map(Vec::len)), (StatusCode::OK, Some(1)), "{body}");

    for (method, uri) in [
        ("DELETE", format!("/api/v1/ai/memories/{memory_id}")),
        ("PATCH", format!("/api/v1/ai/memories/{memory_id}")),
        ("PATCH", "/api/v1/ai/ask-settings".to_string()),
        ("POST", "/api/v1/ai/ask-conversations/main".to_string()),
        ("POST", format!("/api/v1/ai/ask-conversations/{main_id}/messages")),
        ("GET", format!("/api/v1/ai/ask-conversations/{main_id}/messages")),
    ] {
        let (status, body) = call(&state, AGENT_KEY, method, &uri, Some(json!({}))).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {uri}: {body}");
        assert_eq!(body["error"]["details"]["reason"], "agent_key_not_allowed", "{method} {uri}");
    }
}
