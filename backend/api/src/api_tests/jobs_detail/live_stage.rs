use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

#[tokio::test]
async fn job_detail_route_prefers_live_pipeline_stage_snapshot() {
    let state = test_state("detail-live-stage");
    let mut job = JobSnapshot::new(
        "job-route-live-stage".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("old queued detail".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 2/5 批翻译","provider":"","provider_stage":"","event_type":"stage_progress","message":"已完成第 2/5 批翻译","progress_current":2,"progress_total":5,"retry_count":0,"elapsed_ms":1000,"payload":{}}"#,
            "\n",
            r#"{"job_id":"job-route-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event_type":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1100,"payload":{"artifact_key":"output_pdf"}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let app = build_app(state.clone());
    let detail_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail_response.status(), StatusCode::OK);
    let detail_json = read_json(detail_response).await;
    assert!(detail_json["data"].get("stage").is_none());
    assert!(detail_json["data"].get("progress").is_none());
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage"],
        "translating"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage_detail"],
        "已完成第 2/5 批翻译"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["current"],
        2
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["total"],
        5
    );
}
