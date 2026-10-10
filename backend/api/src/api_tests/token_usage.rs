//! /api/v1/usage、/api/v1/jobs/:id/usage、/api/v1/documents/:id/usage 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
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
    let ledger = crate::services::usage::job_usage_ledger_path(&state.config.output_root, "job-usage");
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

    let response = get(&state, "/api/v1/jobs/job-usage/usage").await;
    assert_eq!(response.status(), StatusCode::OK);
    let data = read_json(response).await["data"].clone();
    assert_eq!(data["scope"], "job");
    assert_eq!(data["totals"]["total_tokens"], 151010);
    assert_eq!(data["totals"]["cache_hit_tokens"], 100000);
    assert_eq!(data["totals"]["cache_reported_input_tokens"], 120000);
    assert_eq!(data["by_stage"][0]["label"], "翻译");

    let all = read_json(get(&state, "/api/v1/usage").await).await["data"].clone();
    assert_eq!((all["scope"].as_str(), all["jobs_counted"].as_u64()), (Some("all"), Some(1)));
    assert_eq!(all["totals"]["total_tokens"], 151010);

    let document = read_json(get(&state, "/api/v1/documents/doc-without-jobs/usage").await).await["data"].clone();
    assert_eq!((document["scope"].as_str(), document["totals"]["requests"].as_u64()), (Some("document"), Some(0)));

    assert_eq!(get(&state, "/api/v1/jobs/job-missing/usage").await.status(), StatusCode::NOT_FOUND);
}
