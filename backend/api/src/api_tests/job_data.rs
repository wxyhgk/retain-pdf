//! /api/v1/jobs/:id/data 与 /data/:dataset 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};
use crate::storage_paths::{attach_job_paths, build_job_paths};

async fn get(state: &crate::AppState, uri: &str) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(Request::builder().uri(uri).header("X-API-Key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap()
}

#[tokio::test]
async fn job_data_routes_list_and_query_registered_datasets() {
    let state = test_state("job-data-routes");
    let mut job = JobSnapshot::new("job-data".to_string(), CreateJobInput::default(), vec![]);
    let paths = build_job_paths(&state.config.output_root, "job-data").unwrap();
    attach_job_paths(&mut job, &paths);
    state.db.save_job(&job).unwrap();
    let rows: String = [
        serde_json::json!({"revision_id": "r1", "item_id": "p003-b004", "page_idx": 2, "source": "refine", "ts": "1"}),
        serde_json::json!({"revision_id": "r2", "item_id": "p003-b004", "page_idx": 2, "source": "user", "ts": "2"}),
    ]
    .iter()
    .map(|row| format!("{row}\n"))
    .collect();
    std::fs::write(paths.translated_dir.join("revisions.v1.jsonl"), rows).unwrap();

    let catalog = read_json(get(&state, "/api/v1/jobs/job-data/data").await).await["data"].clone();
    let revisions = catalog["datasets"].as_array().unwrap().iter().find(|d| d["name"] == "revisions").unwrap().clone();
    assert_eq!(revisions["available"], true);

    let data = read_json(get(&state, "/api/v1/jobs/job-data/data/revisions?source=user&fields=source").await).await["data"].clone();
    assert_eq!(data["total"], 1);
    assert_eq!(data["rows"][0]["reader_item_id"], "p003-b0004");
    assert_eq!(data["rows"][0]["page"], 3);

    let groups = read_json(get(&state, "/api/v1/jobs/job-data/data/revisions?group_by=item_id").await).await["data"].clone();
    assert_eq!(groups["groups"][0]["count"], 2);

    assert_eq!(get(&state, "/api/v1/jobs/job-data/data/revisions?nope=1").await.status(), StatusCode::BAD_REQUEST);
    assert_eq!(get(&state, "/api/v1/jobs/job-data/data/secrets").await.status(), StatusCode::NOT_FOUND);
    assert_eq!(get(&state, "/api/v1/jobs/job-missing/data").await.status(), StatusCode::NOT_FOUND);
}
