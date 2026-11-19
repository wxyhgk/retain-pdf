//! /api/v1/usage、/api/v1/documents/:id/usage 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::domain::{now_iso, UploadRecord};
use crate::models::{CreateJobInput, JobSnapshot};

async fn get(state: &crate::AppState, uri: &str) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response")
}

#[tokio::test]
async fn usage_routes_summarize_the_job_ledgers() {
    let state = test_state("token-usage-routes");
    let job = JobSnapshot::new("job-usage".to_string(), CreateJobInput::default(), vec![]);
    state.db.save_job(&job).expect("save job");
    let ledger = crate::services::jobs::job_usage_ledger_path(&state.config.output_root, "job-usage");
    std::fs::create_dir_all(ledger.parent().unwrap()).unwrap();
    std::fs::write(
        &ledger,
        concat!(
            r#"{"ts":"2026-10-10T00:00:00Z","stage":"translation","model":"m","host":"h","input":120000,"output":30000,"cache_hit":100000,"reasoning":5000}"#,
            "\n",
            r#"{"ts":"2026-10-10T00:01:00Z","stage":"refine_review","model":"m","host":"h","input":1000,"output":10,"cache_hit":null}"#,
            "\n",
        ),
    )
    .unwrap();

    let all = read_json(get(&state, "/api/v1/usage").await).await["data"].clone();
    assert_eq!((all["scope"].as_str(), all["jobs_counted"].as_u64()), (Some("all"), Some(1)));
    assert_eq!(all["totals"]["total_tokens"], 151010);
    assert_eq!(all["totals"]["cache_hit_tokens"], 100000);
    assert_eq!(all["totals"]["cache_reported_input_tokens"], 120000);
    assert_eq!(all["by_stage"][0]["label"], "翻译");

    // 有书没任务：200 空汇总。书不存在是 404（见 library_lookup_errors）。
    let upload = UploadRecord {
        upload_id: "up-without-jobs".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/up-without-jobs/book.pdf".to_string(),
        bytes: 1,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: "doc-without-jobs".to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
    let document = read_json(get(&state, "/api/v1/documents/doc-without-jobs/usage").await).await["data"].clone();
    assert_eq!((document["scope"].as_str(), document["totals"]["requests"].as_u64()), (Some("document"), Some(0)));
    assert_eq!(get(&state, "/api/v1/documents/doc-missing/usage").await.status(), StatusCode::NOT_FOUND);
}

async fn post_json(state: &crate::AppState, uri: &str, body: serde_json::Value) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("response")
}

/// 查单价、估价（2026-11-19）经真实路由：报错码、空书库、没翻译过的书退回书库平均。算法见任务包 reports/usage 的单测。
#[tokio::test]
async fn price_lookup_and_estimate_routes() {
    use serde_json::json;
    let state = test_state("usage-estimate-routes");

    let response = post_json(&state, "/api/v1/usage/prices", json!({"items": [{"base_url": "https://api.anthropic.com", "model": "claude-haiku-5-5"}]})).await;
    assert_eq!(response.status(), StatusCode::OK);
    let lookup = read_json(response).await["data"].clone();
    assert_eq!((lookup["items"][0]["price_provider"].as_str(), lookup["items"][0]["price"]["input"].as_f64()), (Some("anthropic"), Some(0.1)));
    let too_many: Vec<_> = (0..101).map(|_| json!({"base_url": "https://api.anthropic.com", "model": "m"})).collect();
    assert_eq!(post_json(&state, "/api/v1/usage/prices", json!({"items": too_many})).await.status(), StatusCode::BAD_REQUEST);
    assert_eq!(post_json(&state, "/api/v1/usage/prices", json!({"items": [], "x": 1})).await.status(), StatusCode::BAD_REQUEST);

    let ok = "base_url=https://api.deepseek.com/v1&model=deepseek-flash";
    let estimate = read_json(get(&state, &format!("/api/v1/usage/estimate?{ok}&pages=20")).await).await["data"].clone();
    assert_eq!((estimate["basis"].as_str(), estimate["pages"].as_u64(), estimate["price_provider"].as_str()), (Some("none"), Some(20), Some("deepseek")), "书库空：没有参照");
    for bad in ["base_url=api.deepseek.com&model=x&pages=20", &format!("{ok}&pages=0"), &format!("{ok}&pages=20&extra=1"), "model=x&pages=20"] {
        assert_eq!(get(&state, &format!("/api/v1/usage/estimate?{bad}")).await.status(), StatusCode::BAD_REQUEST, "{bad}");
    }

    let upload = UploadRecord {
        upload_id: "up-estimate".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/up-estimate/book.pdf".to_string(),
        bytes: 1,
        page_count: 8,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: "doc-estimate".to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
    let document = read_json(get(&state, &format!("/api/v1/documents/doc-estimate/usage/estimate?{ok}")).await).await["data"].clone();
    assert_eq!((document["basis"].as_str(), document["pages"].as_u64()), (Some("none"), Some(8)), "没翻译过、书库也空");
    assert_eq!(get(&state, &format!("/api/v1/documents/doc-missing/usage/estimate?{ok}")).await.status(), StatusCode::NOT_FOUND);
    assert_eq!(get(&state, "/api/v1/documents/doc-estimate/usage/estimate?base_url=x&model=y").await.status(), StatusCode::BAD_REQUEST);
}
