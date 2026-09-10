use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, WorkflowKind};

#[tokio::test]
async fn job_events_route_returns_global_monotonic_seq_after_source_merge() {
    let state = test_state("events-global-seq");
    let job_id = "job-route-events-global-seq";
    let child_job_id = "job-route-events-global-seq-ocr";
    let job_root: PathBuf = state.config.data_root.join("jobs").join(job_id);
    let child_root: PathBuf = state.config.data_root.join("jobs").join(child_job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create parent logs dir");
    fs::create_dir_all(child_root.join("logs")).expect("create child logs dir");

    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().to_string()),
        ocr_job_id: Some(child_job_id.to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save parent job");

    let mut child_input = CreateJobInput::default();
    child_input.workflow = WorkflowKind::Ocr;
    let mut child = JobSnapshot::new(
        child_job_id.to_string(),
        child_input,
        vec!["python".to_string()],
    );
    child.artifacts = Some(JobArtifacts {
        job_root: Some(child_root.to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&child).expect("save child job");

    state
        .db
        .append_event(
            job_id,
            "info",
            Some("queued".to_string()),
            Some("db queued".to_string()),
            None,
            None,
            "job_created",
            Some("job_created".to_string()),
            "db queued",
            Some(0),
            Some(5),
            Some(json!({"origin": "db"})),
            Some(0),
            Some(1),
        )
        .expect("append db event");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-events-global-seq","seq":99,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"rendering","substage":"render_pages","stage_detail":"render page","event_type":"stage_progress","message":"render page","progress_current":1,"progress_total":3,"progress_unit":"page","payload":{"origin":"pipeline"}}"#,
            "\n"
        ),
    )
    .expect("write parent pipeline events");
    fs::write(
        child_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-events-global-seq-ocr","seq":7,"ts":"2026-04-24T00:59:59Z","level":"info","stage":"ocr_processing","substage":"provider_processing","stage_detail":"ocr page","event_type":"stage_progress","message":"ocr page","progress_current":1,"progress_total":3,"progress_unit":"page","payload":{"origin":"ocr_child"}}"#,
            "\n"
        ),
    )
    .expect("write child pipeline events");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/events"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("events request"),
        )
        .await
        .expect("events response");
    assert_eq!(response.status(), StatusCode::OK);

    let body = read_json(response).await;
    let items = body["data"]["items"].as_array().expect("events items");
    assert_eq!(items.len(), 3);
    for (index, item) in items.iter().enumerate() {
        assert_eq!(item["seq"], (index + 1) as i64);
    }
    assert!(items
        .windows(2)
        .all(|pair| pair[0]["seq"].as_i64().expect("left seq")
            < pair[1]["seq"].as_i64().expect("right seq")));
    assert!(items
        .iter()
        .any(|item| item["raw"]["source_kind"] == "pipeline_jsonl"));
    assert!(items
        .iter()
        .any(|item| item["raw"]["source_kind"] == "ocr_child"));
}
