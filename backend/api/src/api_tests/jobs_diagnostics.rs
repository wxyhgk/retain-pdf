use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind};

#[tokio::test]
async fn diagnostics_route_exposes_stable_failure_summary() {
    let state = test_state("diagnostics-route");
    let mut job = JobSnapshot::new(
        "job-diagnostics-route".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.failure = Some(crate::models::JobFailureInfo {
        stage: "failed".to_string(),
        category: "legacy_provider_failed".to_string(),
        code: None,
        failed_stage: Some("translation".to_string()),
        failure_code: Some("upstream_timeout".to_string()),
        failure_category: Some("timeout".to_string()),
        provider_stage: Some("continuation_review".to_string()),
        provider_code: None,
        summary: "翻译阶段超时".to_string(),
        root_cause: Some("provider timed out".to_string()),
        retryable: true,
        upstream_host: None,
        provider: Some("translation".to_string()),
        suggestion: Some("从断点恢复任务".to_string()),
        last_log_line: None,
        raw_excerpt: None,
        raw_error_excerpt: None,
        raw_diagnostic: None,
        ai_diagnostic: None,
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/job-diagnostics-route/diagnostics")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("diagnostics request"),
        )
        .await
        .expect("diagnostics response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["failure_code"], "upstream_timeout");
    assert_eq!(payload["data"]["failed_stage"], "translation");
    assert_eq!(payload["data"]["failed_substage"], "continuation_review");
    assert_eq!(payload["data"]["summary"], "翻译阶段超时");
    assert_eq!(payload["data"]["detail"], "provider timed out");
    assert_eq!(payload["data"]["retryable"], true);
    assert_eq!(payload["data"]["resume_available"], false);
    assert_eq!(payload["data"]["ocr_ambiguity"], serde_json::Value::Null);
}

#[tokio::test]
async fn diagnostics_route_exposes_render_diagnostics_from_pipeline_summary() {
    let state = test_state("diagnostics-render-summary");
    let job_root = state
        .config
        .data_root
        .join("jobs")
        .join("job-render-diagnostics-route");
    let artifacts_dir = job_root.join("artifacts");
    fs::create_dir_all(&artifacts_dir).expect("artifacts dir");
    fs::write(
        artifacts_dir.join("pipeline_summary.json"),
        serde_json::to_vec_pretty(&json!({
            "render_diagnostics": {
                "typst_cover_fallback_pages": {
                    "count": 2,
                    "head": [2, 5],
                    "tail": []
                },
                "typst_cover_fallback_items": {
                    "count": 3,
                    "head": ["p002-b002", "p005-b004", "p005-b007"],
                    "tail": []
                }
            }
        }))
        .expect("summary json"),
    )
    .expect("write pipeline summary");
    let mut job = JobSnapshot::new(
        "job-render-diagnostics-route".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().to_string()),
        summary: Some(
            artifacts_dir
                .join("pipeline_summary.json")
                .to_string_lossy()
                .to_string(),
        ),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/job-render-diagnostics-route/diagnostics")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("diagnostics request"),
        )
        .await
        .expect("diagnostics response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(
        payload["data"]["render_diagnostics"]["typst_cover_fallback_pages"]["count"],
        2
    );
    assert_eq!(
        payload["data"]["render_diagnostics"]["typst_cover_fallback_items"]["head"],
        json!(["p002-b002", "p005-b004", "p005-b007"])
    );
}
