use axum::body::to_bytes;
use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::test_state;
use crate::app::build_app;
use crate::models::api::GlossaryUpsertInput;
use crate::services::glossaries::{create_glossary_view, GlossaryApiDeps};

fn glossary_entry(source: &str, target: &str) -> crate::models::GlossaryEntryInput {
    crate::models::GlossaryEntryInput {
        source: source.to_string(),
        target: target.to_string(),
        note: String::new(),
        level: String::new(),
        match_mode: String::new(),
        context: String::new(),
    }
}

fn seed_glossary(state: &crate::AppState, input: GlossaryUpsertInput) -> crate::models::api::GlossaryDetailView {
    create_glossary_view(&GlossaryApiDeps::new(state.db.as_ref()), &input, crate::db::LOCAL_OWNER)
        .expect("create glossary")
}

async fn send(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri).header("X-API-Key", "test-key");
    let body = match body {
        Some(body) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    let response = build_app(state.clone())
        .oneshot(builder.body(body).expect("request"))
        .await
        .expect("response");
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

#[tokio::test]
async fn export_glossary_csv_route_returns_csv() {
    let state = test_state("glossary-export");
    let app = build_app(state.clone());
    let create = seed_glossary(
        &state,
        GlossaryUpsertInput {
            description: Some("physics glossary".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            ..GlossaryUpsertInput {
                name: "物理 physics".to_string(),
                entries: vec![glossary_entry("band gap", "带隙"), glossary_entry("-OH", "羟基")],
                ..GlossaryUpsertInput::default()
            }
        },
    );

    let request = Request::builder()
        .uri(format!(
            "/api/v1/glossaries/{}/export.csv",
            create.glossary_id
        ))
        .header("X-API-Key", "test-key")
        .body(Body::empty())
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok()),
        Some("text/csv; charset=utf-8")
    );
    assert_eq!(
        response
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .and_then(|v| v.to_str().ok()),
        Some("attachment; filename=\"__ physics.csv\"; filename*=UTF-8''%E7%89%A9%E7%90%86%20physics.csv")
    );
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let text = std::str::from_utf8(&body).expect("csv text");
    assert!(text.starts_with('\u{feff}'), "UTF-8 BOM for Excel");
    assert!(text.contains("band gap"));
    assert!(text.contains("\n'-OH,"), "formula guard: {text}");

    // 导出再粘回 parse-csv 还原成原样。
    let (status, payload) = send(
        &state,
        "POST",
        "/api/v1/glossaries/parse-csv",
        Some(json!({ "csv_text": text })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["data"]["entry_count"], 2);
    assert_eq!(payload["data"]["duplicate_count"], 0);
    assert_eq!(payload["data"]["entries"][1]["source"], "-OH");
}

/// 前端保存只发 `name`、`entries`：描述、语言、启用不能被清掉。
#[tokio::test]
async fn put_keeps_top_level_fields_the_request_leaves_out() {
    let state = test_state("glossary-put-keeps");
    let created = seed_glossary(
        &state,
        GlossaryUpsertInput {
            name: "本书术语".to_string(),
            description: Some("AI 终端写的".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(false),
            entries: vec![glossary_entry("band gap", "带隙")],
            ..GlossaryUpsertInput::default()
        },
    );
    let (status, payload) = send(
        &state,
        "PUT",
        &format!("/api/v1/glossaries/{}", created.glossary_id),
        Some(json!({
            "name": "本书术语",
            "entries": [{"source": "exciton", "target": "激子", "level": "preserve", "match_mode": "case_insensitive", "context": "", "note": ""}]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_eq!(data["description"], "AI 终端写的");
    assert_eq!(data["source_lang"], "en");
    assert_eq!(data["target_lang"], "zh-CN");
    assert_eq!(data["enabled"], false);
    assert_eq!(data["entry_count"], 1);

    // name、entries 仍必填（缺字段是不合 schema，422）。
    let (status, _) = send(
        &state,
        "PUT",
        &format!("/api/v1/glossaries/{}", created.glossary_id),
        Some(json!({ "name": "本书术语" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn put_with_a_stale_expected_updated_at_is_409_glossary_changed() {
    let state = test_state("glossary-put-cas");
    let created = seed_glossary(
        &state,
        GlossaryUpsertInput {
            name: "physics".to_string(),
            entries: vec![glossary_entry("band gap", "带隙")],
            ..GlossaryUpsertInput::default()
        },
    );
    let uri = format!("/api/v1/glossaries/{}", created.glossary_id);
    let (status, first) = send(
        &state,
        "PUT",
        &uri,
        Some(json!({"name": "physics", "entries": [], "expected_updated_at": created.updated_at})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{first}");

    let (status, payload) = send(
        &state,
        "PUT",
        &uri,
        Some(json!({"name": "physics", "entries": [], "expected_updated_at": created.updated_at})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "glossary_changed");

    // 不给 expected_updated_at 照旧后写覆盖。
    let (status, _) = send(&state, "PUT", &uri, Some(json!({"name": "physics", "entries": []}))).await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn put_on_a_deleted_glossary_is_404_and_does_not_recreate_it() {
    let state = test_state("glossary-put-deleted");
    let created = seed_glossary(
        &state,
        GlossaryUpsertInput { name: "physics".to_string(), ..GlossaryUpsertInput::default() },
    );
    let uri = format!("/api/v1/glossaries/{}", created.glossary_id);
    let (status, _) = send(&state, "DELETE", &uri, None).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = send(&state, "PUT", &uri, Some(json!({"name": "physics", "entries": []}))).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = send(&state, "GET", &uri, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn list_filters_enabled_rejects_unknown_params_and_ignores_empty_q() {
    let state = test_state("glossary-list-query");
    seed_glossary(&state, GlossaryUpsertInput { name: "on".to_string(), ..GlossaryUpsertInput::default() });
    seed_glossary(
        &state,
        GlossaryUpsertInput { name: "off".to_string(), enabled: Some(false), ..GlossaryUpsertInput::default() },
    );

    let (status, payload) = send(&state, "GET", "/api/v1/glossaries?enabled=true", None).await;
    assert_eq!(status, StatusCode::OK);
    let names: Vec<&str> = payload["data"]["items"]
        .as_array()
        .expect("items")
        .iter()
        .map(|item| item["name"].as_str().unwrap_or_default())
        .collect();
    assert_eq!(names, vec!["on"]);

    let (status, payload) = send(&state, "GET", "/api/v1/glossaries?q=", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["data"]["items"].as_array().map(Vec::len), Some(2));

    let (status, _) = send(&state, "GET", "/api/v1/glossaries?limit=10", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn parse_csv_reports_duplicates_and_row_numbers() {
    let state = test_state("glossary-parse-csv");
    let (status, payload) = send(
        &state,
        "POST",
        "/api/v1/glossaries/parse-csv",
        Some(json!({ "csv_text": "原词\t译文\nUS\t美国\nus\t微秒\nUS\t合众国\n" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["entry_count"], 2);
    assert_eq!(payload["data"]["duplicate_count"], 1);

    let (status, payload) = send(
        &state,
        "POST",
        "/api/v1/glossaries/parse-csv",
        Some(json!({ "csv_text": "DFT,密度泛函理论\nKohn-Sham,\n" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(payload["message"].as_str().unwrap_or_default().starts_with("row 2:"), "{payload}");
}

#[tokio::test]
async fn json_entries_with_unknown_level_or_bad_regex_are_400() {
    let state = test_state("glossary-json-validation");
    let (status, payload) = send(
        &state,
        "POST",
        "/api/v1/glossaries",
        Some(json!({"name": "x", "entries": [{"source": "DFT", "target": "密度泛函理论", "level": "canonicl"}]})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(payload["message"].as_str().unwrap_or_default().contains("canonicl"), "{payload}");

    let (status, payload) = send(
        &state,
        "POST",
        "/api/v1/glossaries",
        Some(json!({"name": "x", "entries": [{"source": "band (gap", "target": "带隙", "match_mode": "regex"}]})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(payload["message"].as_str().unwrap_or_default().contains("band (gap"), "{payload}");
}

/// 建任务引用了不存在或停用的术语表：请求写错了，400（以前不存在是 404，停用的照样能用）。
#[tokio::test]
async fn creating_a_job_with_a_missing_or_disabled_glossary_is_400() {
    let state = test_state("glossary-job-create");
    let disabled = seed_glossary(
        &state,
        GlossaryUpsertInput { name: "off".to_string(), enabled: Some(false), ..GlossaryUpsertInput::default() },
    );
    for (glossary_id, expected) in [("glossary-nope", "not found"), (disabled.glossary_id.as_str(), "disabled")] {
        let (status, payload) = send(
            &state,
            "POST",
            "/api/v1/jobs",
            Some(json!({
                "workflow": "book",
                "source": {"upload_id": "upload-missing"},
                "translation": {"glossary_id": glossary_id, "api_key": "sk-test", "model": "deepseek-flash", "base_url": "https://api.deepseek.com/v1"}
            })),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
        assert!(payload["message"].as_str().unwrap_or_default().contains(expected), "{payload}");
    }
}
