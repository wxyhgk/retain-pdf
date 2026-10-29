//! 术语表契约 `glossaries.v1` 的生产者锁（设置类第 2 批第 1 组，2026-10-29）。
//!
//! 返回：打真实接口，拿 serde 实际写出来的 JSON，对着 backend-root/contracts 里的定义核对类型和键集合
//! （多一个键、少一个键都红）。请求：每个请求类型都是 `deny_unknown_fields`，契约的 `properties` 要和 Rust 认的字段一样。

use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::job_view_contract::{assert_definition, assert_exact_object_keys, contract};
use super::jobs_common::test_state;
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::send;
use crate::app::build_app;
use crate::models::api::{GlossaryCsvParseInput, GlossaryUpsertInput, ListGlossariesQuery};
use crate::models::GlossaryEntryInput;

const CONTRACT: &str = "glossaries.v1.schema.json";

async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

fn assert_exact(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_definition(value, contract, name, path);
    assert_exact_object_keys(value, contract, name, path);
}

fn assert_detail(value: &Value, contract: &Value, path: &str) {
    assert_exact(value, contract, "GlossaryDetailView", path);
    for (index, entry) in value["entries"].as_array().expect("entries").iter().enumerate() {
        assert_exact(entry, contract, "GlossaryEntryInput", &format!("{path}.entries[{index}]"));
    }
}

#[tokio::test]
async fn glossary_views_match_published_schema() {
    let state = test_state("glossaries-contract");
    let contract = contract(CONTRACT);
    let body = json!({
        "name": "化学",
        "description": "有机化学",
        "source_lang": "en",
        "target_lang": "zh",
        "enabled": true,
        "entries": [
            { "source": "alkene", "target": "烯烃", "note": "", "level": "canonical", "match_mode": "exact", "context": "" },
            { "source": "DFT", "target": "", "level": "preserve" }
        ]
    });

    let created = ok_data(&state, "POST", "/api/v1/glossaries", Some(body.clone())).await;
    assert_detail(&created, &contract, "create");
    let id = created["glossary_id"].as_str().expect("glossary_id").to_string();

    let list = ok_data(&state, "GET", "/api/v1/glossaries?enabled=true&q=", None).await;
    assert_exact(&list, &contract, "GlossaryListView", "list");
    let items = list["items"].as_array().expect("items");
    assert_eq!(items.len(), 1);
    assert_exact(&items[0], &contract, "GlossarySummaryView", "list.items[0]");

    let one = ok_data(&state, "GET", &format!("/api/v1/glossaries/{id}"), None).await;
    assert_detail(&one, &contract, "get");

    let mut update = body;
    update["expected_updated_at"] = one["updated_at"].clone();
    let updated = ok_data(&state, "PUT", &format!("/api/v1/glossaries/{id}"), Some(update)).await;
    assert_detail(&updated, &contract, "update");

    let parsed = ok_data(
        &state,
        "POST",
        "/api/v1/glossaries/parse-csv",
        Some(json!({ "csv_text": "source,target\nalkene,烯烃\nalkene,烯\n" })),
    )
    .await;
    assert_exact(&parsed, &contract, "GlossaryCsvParseView", "parse-csv");
    for (index, entry) in parsed["entries"].as_array().expect("entries").iter().enumerate() {
        assert_exact(entry, &contract, "GlossaryEntryInput", &format!("parse-csv.entries[{index}]"));
    }

    // 导出 CSV 是 binary：直接是文件，不是信封。
    let request = Request::builder()
        .uri(format!("/api/v1/glossaries/{id}/export.csv"))
        .header("X-API-Key", "test-key")
        .body(Body::empty())
        .unwrap();
    let response = build_app(state.clone()).oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let content_type = response.headers()[header::CONTENT_TYPE].to_str().unwrap().to_string();
    assert!(content_type.starts_with("text/csv"), "{content_type}");
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert!(String::from_utf8_lossy(&bytes).starts_with("\u{feff}source,target,note,level,match_mode,context"));

    let deleted = ok_data(&state, "DELETE", &format!("/api/v1/glossaries/{id}"), None).await;
    assert_detail(&deleted, &contract, "delete");
}

#[test]
fn request_bodies_and_queries_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<GlossaryUpsertInput>(&contract, "GlossaryUpsertInput");
    assert_request_fields_match::<GlossaryCsvParseInput>(&contract, "GlossaryCsvParseInput");
    assert_request_fields_match::<ListGlossariesQuery>(&contract, "ListGlossariesQuery");
    assert_request_fields_match::<GlossaryEntryInput>(&contract, "GlossaryEntryInput");
}
