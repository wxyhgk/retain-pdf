use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

use super::jobs_common::{read_json, test_state};

#[tokio::test]
async fn jobs_list_route_prefers_live_pipeline_stage_snapshot() {
    let state = test_state("list-live-stage");
    let mut job = JobSnapshot::new(
        "job-route-list-live-stage".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.stage = Some("queued".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-list-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 3/8 批翻译","provider":"","provider_stage":"","event_type":"stage_progress","message":"已完成第 3/8 批翻译","progress_current":3,"progress_total":8,"retry_count":0,"elapsed_ms":900,"payload":{}}"#,
            "\n",
            r#"{"job_id":"job-route-list-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event_type":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1000,"payload":{"artifact_key":"output_pdf"}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let app = build_app(state.clone());
    let list_response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("list request"),
        )
        .await
        .expect("list response");
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_json = read_json(list_response).await;
    let items = list_json["data"]["items"].as_array().expect("items array");
    let item = items
        .iter()
        .find(|item| item["job_id"] == "job-route-list-live-stage")
        .expect("job item");
    assert!(item.get("stage").is_none());
    assert!(item.get("progress").is_none());
    assert_eq!(item["stage_snapshot"]["stage"], "translating");
    assert_eq!(item["stage_snapshot"]["display_stage"], "translation");
}
