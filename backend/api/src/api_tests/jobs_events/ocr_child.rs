use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

use crate::api_tests::jobs_common::{read_json, test_state};

#[tokio::test]
async fn main_job_events_include_ocr_child_page_progress() {
    let state = test_state("events-ocr-child-progress");
    let mut parent = JobSnapshot::new(
        "job-route-parent-progress".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    let parent_root: PathBuf = state.config.data_root.join("jobs").join(&parent.job_id);
    fs::create_dir_all(parent_root.join("logs")).expect("create parent logs dir");
    parent
        .artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(parent_root.to_string_lossy().to_string());
    parent.artifacts.as_mut().unwrap().ocr_job_id =
        Some("job-route-parent-progress-ocr".to_string());
    state.db.save_job(&parent).expect("save parent job");

    let mut child_input = CreateJobInput::default();
    child_input.workflow = crate::models::WorkflowKind::Ocr;
    let mut child = JobSnapshot::new(
        "job-route-parent-progress-ocr".to_string(),
        child_input,
        vec!["python".to_string()],
    );
    let child_root: PathBuf = state.config.data_root.join("jobs").join(&child.job_id);
    fs::create_dir_all(child_root.join("logs")).expect("create child logs dir");
    child
        .artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(child_root.to_string_lossy().to_string());
    state.db.save_job(&child).expect("save child job");
    fs::write(
        child_root.join("logs").join("pipeline_events.jsonl"),
        r#"{"job_id":"job-route-parent-progress-ocr","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","user_stage":"ocr","stage":"ocr_processing","substage":"provider_processing","stage_detail":"Paddle 正在解析文件，第 12/34 页","provider":"paddle","provider_stage":"provider_processing","event_type":"stage_progress","message":"Paddle 正在解析文件，第 12/34 页","progress_current":12,"progress_total":34,"progress_unit":"page","payload":{"provider_task_id":"task-1"}}"#,
    )
    .expect("write child pipeline events");

    let app = build_app(state.clone());
    let events_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}/events", parent.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("events request"),
        )
        .await
        .expect("events response");
    assert_eq!(events_response.status(), StatusCode::OK);
    let events_json = read_json(events_response).await;
    let items = events_json["data"]["items"]
        .as_array()
        .expect("events items");
    let ocr_progress = items
        .iter()
        .find(|item| item["display_stage"] == "ocr" && item["raw_event_type"] == "stage_progress")
        .expect("ocr child progress event");
    assert_eq!(ocr_progress["job_id"], parent.job_id);
    assert_eq!(ocr_progress["stage"], "ocr_processing");
    assert!(ocr_progress.get("user_stage").is_none());
    assert_eq!(ocr_progress["event_type"], "progress");
    assert_eq!(ocr_progress["substage"], "ocr_processing");
    assert!(ocr_progress.get("progress_unit").is_none());
    assert!(ocr_progress.get("progress_current").is_none());
    assert!(ocr_progress.get("progress_total").is_none());
    assert_eq!(ocr_progress["progress"]["unit"], "page");
    assert_eq!(
        ocr_progress["payload"]["source_job_id"],
        "job-route-parent-progress-ocr"
    );
    assert_eq!(ocr_progress["raw"]["source_kind"], "ocr_child");
}
