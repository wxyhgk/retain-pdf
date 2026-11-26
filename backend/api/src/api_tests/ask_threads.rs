//! 阅读页提问的问答记录（契约 `ask-threads.v1`，2026-11-25）：建、列、读、改、删走真接口，返回对着契约核对键集合；
//! 请求类型和契约字段一一对上；校验、上限、不在这本书上、删书跟着删。

use axum::http::StatusCode;
use serde_json::{json, Value};

use super::job_view_contract::{assert_definition, assert_exact_object_keys, contract};
use super::jobs_common::test_state;
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::{seed_document, send};
use crate::models::api::{AskAnchorInput, AskMessageInput, AskPointInput, CreateAskThreadInput, PatchAskThreadInput};

const CONTRACT: &str = "ask-threads.v1.schema.json";

async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

/// 类型对、这一层和锚点、每条问答的键集合都正好等于契约。
fn assert_thread(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_definition(value, contract, name, path);
    assert_exact_object_keys(value, contract, name, path);
    assert_exact_object_keys(&value["anchor"], contract, "AskAnchorRecord", &format!("{path}.anchor"));
    if let Some(messages) = value.get("messages").and_then(Value::as_array) {
        for (index, message) in messages.iter().enumerate() {
            assert_exact_object_keys(message, contract, "AskMessageRecord", &format!("{path}.messages[{index}]"));
        }
    }
}

fn anchor() -> Value {
    json!({
        "pane": "translated",
        "page": 3,
        "item_id": "p3-b7",
        "selection": "选中的一句",
        "source_text": "Original paragraph.",
        "translated_text": "原文段落。",
        "section": "2 方法",
        "point": { "x": 0.1, "y": 0.42 }
    })
}

#[tokio::test]
async fn threads_are_created_listed_read_patched_and_deleted() {
    let state = test_state("ask-threads-crud");
    let contract = contract(CONTRACT);
    let book = seed_document(&state, b"ask-threads-a");
    let base = format!("/api/v1/documents/{book}/ask-threads");

    let empty = ok_data(&state, "GET", &base, None).await;
    assert_definition(&empty, &contract, "AskThreadListView", "empty list");
    assert_eq!(empty["threads"], json!([]));

    // 第一轮答完再建：连同一问一答
    let usage = json!({ "model": "claude-haiku-5-5", "input_tokens": 1400, "output_tokens": 120, "cache_read_tokens": 1100 });
    let created = ok_data(
        &state,
        "POST",
        &base,
        Some(json!({
            "agent_id": "retainpdf",
            "session_id": "sess-1",
            "anchor": anchor(),
            "messages": [
                { "role": "user", "text": "  这句\n是什么意思？ " },
                { "role": "assistant", "text": "意思是……", "thought": "先看上下文", "usage": usage }
            ]
        })),
    )
    .await;
    assert_thread(&created, &contract, "AskThreadView", "created");
    let thread_id = created["thread_id"].as_str().unwrap().to_string();
    assert!(thread_id.starts_with("ask-"), "{thread_id}");
    assert_eq!(created["document_id"], book.as_str());
    assert_eq!(created["title"], "这句 是什么意思？");
    assert_eq!(created["anchor"], anchor());
    assert_eq!(created["message_count"], 2);
    assert_eq!(created["messages"][0], json!({ "role": "user", "text": "  这句\n是什么意思？ ", "thought": null, "usage": null }));
    assert_eq!(created["messages"][1]["usage"], usage);

    // 只给栏和页（空白处问的）：其余是空的
    let bare = ok_data(
        &state,
        "POST",
        &base,
        Some(json!({ "agent_id": "claude-code", "anchor": { "pane": "source", "page": 1, "item_id": null, "point": null } })),
    )
    .await;
    assert_thread(&bare, &contract, "AskThreadView", "bare");
    assert_eq!(
        bare["anchor"],
        json!({ "pane": "source", "page": 1, "item_id": null, "selection": "", "source_text": "", "translated_text": "", "section": "", "point": null })
    );
    assert_eq!((&bare["title"], &bare["session_id"], &bare["message_count"]), (&json!(""), &Value::Null, &json!(0)));

    // 列表：不带问答正文
    let list = ok_data(&state, "GET", &base, None).await;
    assert_definition(&list, &contract, "AskThreadListView", "list");
    assert_eq!(list["threads"].as_array().unwrap().len(), 2);
    for (index, item) in list["threads"].as_array().unwrap().iter().enumerate() {
        assert_thread(item, &contract, "AskThreadRecord", &format!("list.threads[{index}]"));
    }

    // 追问一轮：整份写回；换会话编号
    let patched = ok_data(
        &state,
        "PATCH",
        &format!("{base}/{thread_id}"),
        Some(json!({
            "session_id": "sess-2",
            "messages": [
                { "role": "user", "text": "这句是什么意思？" },
                { "role": "assistant", "text": "意思是……" },
                { "role": "user", "text": "再举个例子" },
                { "role": "assistant", "text": "比如……", "thought": "" }
            ]
        })),
    )
    .await;
    assert_thread(&patched, &contract, "AskThreadView", "patched");
    assert_eq!((&patched["message_count"], &patched["session_id"], &patched["title"]), (&json!(4), &json!("sess-2"), &json!("这句是什么意思？")));
    assert_eq!(patched["messages"][3]["thought"], Value::Null, "只有空白的思考当没有");
    assert_eq!(patched["anchor"], anchor(), "锚点不改");
    // 只清会话编号，问答不动
    let cleared = ok_data(&state, "PATCH", &format!("{base}/{thread_id}"), Some(json!({ "session_id": null }))).await;
    assert_eq!((&cleared["session_id"], &cleared["message_count"]), (&Value::Null, &json!(4)));

    let read = ok_data(&state, "GET", &format!("{base}/{thread_id}"), None).await;
    assert_thread(&read, &contract, "AskThreadView", "read");
    assert_eq!(read["messages"], cleared["messages"]);

    // 删
    let deleted = ok_data(&state, "DELETE", &format!("{base}/{thread_id}"), None).await;
    assert_definition(&deleted, &contract, "AskThreadDeleteResultView", "deleted");
    assert_exact_object_keys(&deleted, &contract, "AskThreadDeleteResultView", "deleted");
    assert_eq!(deleted, json!({ "thread_id": thread_id, "deleted": true }));
    let (status, _) = send(&state, "GET", &format!("{base}/{thread_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "DELETE", &format!("{base}/{thread_id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(ok_data(&state, "GET", &base, None).await["threads"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn threads_belong_to_their_book_and_go_with_it() {
    let state = test_state("ask-threads-ownership");
    let book = seed_document(&state, b"ask-threads-own-a");
    let other = seed_document(&state, b"ask-threads-own-b");
    let created =
        ok_data(&state, "POST", &format!("/api/v1/documents/{book}/ask-threads"), Some(json!({ "agent_id": "retainpdf", "anchor": anchor() })))
            .await;
    let thread_id = created["thread_id"].as_str().unwrap();

    // 换一本书的地址：读、改、删都是 404，原书上的不受影响
    let elsewhere = format!("/api/v1/documents/{other}/ask-threads/{thread_id}");
    for (method, body) in [("GET", None), ("PATCH", Some(json!({ "messages": [] }))), ("DELETE", None)] {
        let (status, payload) = send(&state, method, &elsewhere, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method}: {payload}");
    }
    assert_eq!(ok_data(&state, "GET", &format!("/api/v1/documents/{other}/ask-threads"), None).await["threads"], json!([]));

    // 没有这本书
    let (status, _) = send(&state, "GET", "/api/v1/documents/no-such-book/ask-threads", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(
        &state,
        "POST",
        "/api/v1/documents/no-such-book/ask-threads",
        Some(json!({ "agent_id": "retainpdf", "anchor": anchor() })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // 删书：问答记录跟着删
    ok_data(&state, "DELETE", &format!("/api/v1/documents/{book}"), None).await;
    let left: i64 = rusqlite::Connection::open(state.config.jobs_db_path.clone())
        .unwrap()
        .query_row("SELECT COUNT(*) FROM ask_threads", [], |row| row.get(0))
        .unwrap();
    assert_eq!(left, 0);
}

/// pi 在 `<数据目录>/ask-pi/sessions/` 下写的会话文件：`<时间>_<会话编号>.jsonl`，第一行是会话头（`id` 就是 ACP 的会话编号）。
fn write_pi_session(state: &crate::AppState, relative_dir: &str, session_id: &str) -> std::path::PathBuf {
    let dir = state.config.data_root.join("ask-pi").join("sessions").join(relative_dir);
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(format!("2026-11-26T08-00-00-000Z_{session_id}.jsonl"));
    let header = json!({ "type": "session", "version": 3, "id": session_id, "timestamp": "2026-11-26T08:00:00.000Z", "cwd": "/books/x" });
    std::fs::write(&path, format!("{header}\n{{\"type\":\"message\",\"text\":\"整段对话\"}}\n")).unwrap();
    path
}

async fn create_pi_thread(state: &crate::AppState, book: &str, session_id: &str) -> String {
    let created = ok_data(
        state,
        "POST",
        &format!("/api/v1/documents/{book}/ask-threads"),
        Some(json!({ "agent_id": "retainpdf-pi", "session_id": session_id, "anchor": anchor() })),
    )
    .await;
    created["thread_id"].as_str().unwrap().to_string()
}

/// 删一次提问，pi 的会话文件（整段对话）跟着删；还有别的提问记着同一个会话时留着；
/// 没有提问记着的会话文件不动（S53）。
#[tokio::test]
async fn deleting_a_thread_removes_its_pi_session_file() {
    let state = test_state("ask-threads-pi-session");
    let book = seed_document(&state, b"ask-threads-pi-a");
    let (s1, s2, stray) = (
        "019ab000-0000-7000-8000-000000000001",
        "019ab000-0000-7000-8000-000000000002",
        "019ab000-0000-7000-8000-000000000009",
    );
    let s1_file = write_pi_session(&state, "", s1);
    let s2_file = write_pi_session(&state, "--books-x--", s2);
    let stray_file = write_pi_session(&state, "", stray);
    let first = create_pi_thread(&state, &book, s1).await;
    let shares_s1 = create_pi_thread(&state, &book, s1).await;
    let second = create_pi_thread(&state, &book, s2).await;

    ok_data(&state, "DELETE", &format!("/api/v1/documents/{book}/ask-threads/{second}"), None).await;
    assert!(!s2_file.exists(), "删了提问，pi 的会话文件还在");

    ok_data(&state, "DELETE", &format!("/api/v1/documents/{book}/ask-threads/{first}"), None).await;
    assert!(s1_file.exists(), "还有提问记着这个会话，不能删");
    ok_data(&state, "DELETE", &format!("/api/v1/documents/{book}/ask-threads/{shares_s1}"), None).await;
    assert!(!s1_file.exists(), "最后一个记着它的提问删了，会话文件该删");

    assert!(stray_file.exists(), "没有提问记着的会话文件不动");
}

/// 删书：这本书所有提问的 pi 会话一起删，别的书的不动（S53）。
#[tokio::test]
async fn deleting_a_book_removes_the_pi_sessions_of_its_threads() {
    let state = test_state("ask-threads-pi-book");
    let book = seed_document(&state, b"ask-threads-pi-book-a");
    let other = seed_document(&state, b"ask-threads-pi-book-b");
    let (mine_a, mine_b, theirs) = (
        "019ab000-0000-7000-8000-00000000000a",
        "019ab000-0000-7000-8000-00000000000b",
        "019ab000-0000-7000-8000-00000000000c",
    );
    let files = [write_pi_session(&state, "", mine_a), write_pi_session(&state, "", mine_b)];
    let theirs_file = write_pi_session(&state, "", theirs);
    create_pi_thread(&state, &book, mine_a).await;
    create_pi_thread(&state, &book, mine_b).await;
    create_pi_thread(&state, &other, theirs).await;

    ok_data(&state, "DELETE", &format!("/api/v1/documents/{book}"), None).await;
    for file in &files {
        assert!(!file.exists(), "删书后 pi 会话还在：{}", file.display());
    }
    assert!(theirs_file.exists(), "别的书的会话不能动");
}

#[tokio::test]
async fn bad_requests_and_limits_are_refused() {
    let state = test_state("ask-threads-validation");
    let book = seed_document(&state, b"ask-threads-validation");
    let base = format!("/api/v1/documents/{book}/ask-threads");
    let bad_bodies = [
        ("unknown field", json!({ "agent_id": "retainpdf", "anchor": anchor(), "extra": 1 })),
        ("unknown anchor field", json!({ "agent_id": "retainpdf", "anchor": { "pane": "source", "page": 1, "itemId": "x" } })),
        ("missing anchor", json!({ "agent_id": "retainpdf" })),
        ("bad pane", json!({ "agent_id": "retainpdf", "anchor": { "pane": "left", "page": 1 } })),
        ("page 0", json!({ "agent_id": "retainpdf", "anchor": { "pane": "source", "page": 0 } })),
        ("point outside", json!({ "agent_id": "retainpdf", "anchor": { "pane": "source", "page": 1, "point": { "x": 1.5, "y": 0 } } })),
        ("blank agent", json!({ "agent_id": " ", "anchor": anchor() })),
        ("agent with space", json!({ "agent_id": "claude code", "anchor": anchor() })),
        ("bad role", json!({ "agent_id": "retainpdf", "anchor": anchor(), "messages": [{ "role": "system", "text": "x" }] })),
        ("usage not object", json!({ "agent_id": "retainpdf", "anchor": anchor(), "messages": [{ "role": "assistant", "text": "x", "usage": 3 }] })),
        ("text too long", json!({ "agent_id": "retainpdf", "anchor": anchor(), "messages": [{ "role": "user", "text": "字".repeat(50_001) }] })),
        (
            "too many messages",
            json!({ "agent_id": "retainpdf", "anchor": anchor(), "messages": vec![json!({ "role": "user", "text": "x" }); 201] }),
        ),
    ];
    for (what, body) in bad_bodies {
        let (status, payload) = send(&state, "POST", &base, Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{what}: {payload}");
    }
    assert_eq!(ok_data(&state, "GET", &base, None).await["threads"], json!([]), "nothing was stored");

    // 正文都不超、加起来超 1 MB（一条 40000 个三字节的字 = 12 万字节，9 条 108 万）
    let created = ok_data(&state, "POST", &base, Some(json!({ "agent_id": "retainpdf", "anchor": anchor() }))).await;
    let thread = format!("{base}/{}", created["thread_id"].as_str().unwrap());
    let big = json!({ "role": "assistant", "text": "字".repeat(40_000) });
    let (status, payload) = send(&state, "PATCH", &thread, Some(json!({ "messages": vec![big; 9] }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    let (status, _) = send(&state, "PATCH", &thread, Some(json!({ "agent_id": "" }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(ok_data(&state, "GET", &thread, None).await["message_count"], 0, "refused writes change nothing");

    // 锚点里的长字截断，不报错
    let long = ok_data(
        &state,
        "POST",
        &base,
        Some(json!({ "agent_id": "retainpdf", "anchor": { "pane": "source", "page": 1, "source_text": "a".repeat(9_000), "section": "节".repeat(300) } })),
    )
    .await;
    assert_eq!(long["anchor"]["source_text"].as_str().unwrap().len(), 8_000);
    assert_eq!(long["anchor"]["section"].as_str().unwrap().chars().count(), 200);
}

#[tokio::test]
async fn a_book_holds_at_most_500_threads() {
    let state = test_state("ask-threads-limit");
    let book = seed_document(&state, b"ask-threads-limit");
    // 直接往库里塞到上限（走接口 500 次太慢）
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).unwrap();
    for index in 0..500 {
        conn.execute(
            "INSERT INTO ask_threads (thread_id, document_id, agent_id, pane, page, created_at, updated_at)
             VALUES (?1, ?2, 'retainpdf', 'source', 1, '2026-11-25T00:00:00Z', '2026-11-25T00:00:00Z')",
            rusqlite::params![format!("ask-seed-{index}"), book],
        )
        .unwrap();
    }
    let (status, payload) = send(
        &state,
        "POST",
        &format!("/api/v1/documents/{book}/ask-threads"),
        Some(json!({ "agent_id": "retainpdf", "anchor": anchor() })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "ask_thread_limit", "{payload}");
    assert_eq!(payload["error"]["details"]["limit"], 500, "{payload}");
}

#[test]
fn request_bodies_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<CreateAskThreadInput>(&contract, "CreateAskThreadInput");
    assert_request_fields_match::<PatchAskThreadInput>(&contract, "PatchAskThreadInput");
    assert_request_fields_match::<AskAnchorInput>(&contract, "AskAnchorInput");
    assert_request_fields_match::<AskMessageInput>(&contract, "AskMessageInput");
    assert_request_fields_match::<AskPointInput>(&contract, "AskPoint");
    // 端点清单里的每个 input / output 都有定义。
    for endpoint in contract["endpoints"].as_array().expect("endpoints") {
        for role in ["input", "output"] {
            if let Some(name) = endpoint.get(role).and_then(Value::as_str) {
                assert!(contract["definitions"].get(name).is_some(), "{role} {name} 没有定义");
            }
        }
    }
}
