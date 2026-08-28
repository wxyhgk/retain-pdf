use axum::body::to_bytes;
use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::test_state;
use crate::app::build_app;
use crate::models::GlossaryUpsertInput;

#[tokio::test]
async fn export_glossary_csv_route_returns_csv() {
    let state = test_state("glossary-export");
    let app = build_app(state.clone());
    let create = crate::services::glossaries::create_glossary(
        state.db.as_ref(),
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "physics".to_string(),
            description: "physics glossary".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: vec![crate::models::GlossaryEntryInput {
                source: "band gap".to_string(),
                target: "khoảng cách dải".to_string(),
                note: String::new(),
                level: String::new(),
                match_mode: String::new(),
                context: String::new(),
            }],
        },
    )
    .expect("create glossary");

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
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let text = std::str::from_utf8(&body).expect("csv text");
    assert!(text.contains("band gap"));
}

#[tokio::test]
async fn import_glossary_route_creates_glossary() {
    let state = test_state("glossary-import");
    let app = build_app(state.clone());
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/glossaries/import")
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            r#"{
                "name": "imported",
                "description": "imported glossary",
                "source_lang": "en",
                "target_lang": "zh-CN",
                "enabled": true,
                "entries": [
                    {"source": "SCF", "target": "trường tự hợp", "level": "preferred"}
                ]
            }"#,
        ))
        .expect("request");

    let response = app.oneshot(request).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    let payload: serde_json::Value = serde_json::from_slice(&body).expect("json");
    assert_eq!(payload["data"]["name"], "imported");
    assert_eq!(payload["data"]["entry_count"], 1);
    assert!(!payload["data"]["glossary_id"]
        .as_str()
        .unwrap_or("")
        .is_empty());
}
