//! /api/v1/jobs/:id/reports/quality 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, seed_legacy_layout_job, seed_virtual_job, test_state};
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
async fn quality_route_summarizes_reports() {
    let state = test_state("quality-routes");
    let mut job = JobSnapshot::new("job-quality".to_string(), CreateJobInput::default(), vec![]);
    let paths = build_job_paths(&state.config.output_root, "job-quality").unwrap();
    attach_job_paths(&mut job, &paths);
    state.db.save_job(&job).unwrap();
    std::fs::write(
        paths.artifacts_dir.join("fit_report.v1.json"),
        serde_json::json!({
            "summary": {"blocks": 2, "overflow_blocks": 1, "min_scale": 0.6},
            "blocks": [
                {"item_id": "p003-b007", "page": 3, "measured": true, "scale": 0.95, "overflow": true},
                {"item_id": "p004-b001", "page": 4, "measured": true, "scale": 0.6, "overflow": false},
            ]
        })
        .to_string(),
    )
    .unwrap();

    let summary = read_json(get(&state, "/api/v1/jobs/job-quality/reports/quality").await).await["data"].clone();
    assert_eq!(summary["layout"]["overflow_pages"], serde_json::json!([3]));
    assert!(summary["qa"].is_null() && summary["refine"].is_null());

    assert_eq!(get(&state, "/api/v1/jobs/job-missing/reports/quality").await.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn quality_reads_a_merged_reading_job_and_rejects_legacy_layouts() {
    let state = test_state("quality-virtual");
    let (job_id, _root) = seed_virtual_job(&state);

    // 合并目录里没有报告：摘要的各部分是 null，不是错误。
    let response = get(&state, &format!("/api/v1/jobs/{job_id}/reports/quality")).await;
    assert_eq!(response.status(), StatusCode::OK);
    let summary = read_json(response).await["data"].clone();
    assert!(summary["qa"].is_null() && summary["refine"].is_null(), "{summary}");

    seed_legacy_layout_job(&state, "job-legacy");
    assert_eq!(get(&state, "/api/v1/jobs/job-legacy/reports/quality").await.status(), StatusCode::CONFLICT);
}
