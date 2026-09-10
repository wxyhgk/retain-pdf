use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

use crate::api_tests::jobs_common::{read_json, test_state};

#[tokio::test]
async fn job_events_route_classifies_new_pipeline_substages() {
    let state = test_state("events-new-pipeline-substages");
    let mut job = JobSnapshot::new(
        "job-route-new-pipeline-substages".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-new-pipeline-substages","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"agent_repair","substage":"agent_repair","stage_detail":"翻译结果修复完成","event_type":"stage_progress","semantic_event_type":"progress","message":"翻译结果修复完成","progress_current":1,"progress_total":2,"payload":{}}"#,
            "\n",
            r#"{"job_id":"job-route-new-pipeline-substages","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"render_preprocess","substage":"render_prewarm","stage_detail":"渲染 payload 预热完成","event_type":"stage_progress","semantic_event_type":"progress","message":"render payload prewarm: ready","progress_current":2,"progress_total":3,"progress_unit":"step","payload":{}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs/job-route-new-pipeline-substages/events")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("events request"),
        )
        .await
        .expect("events response");
    assert_eq!(response.status(), StatusCode::OK);
    let events_json = read_json(response).await;
    let items = events_json["data"]["items"]
        .as_array()
        .expect("events items");
    assert_eq!(items[0]["stage"], "agent_repair");
    assert_eq!(items[0]["display_stage"], "translation");
    assert_eq!(items[0]["substage"], "agent_repair");
    assert_eq!(items[0]["progress"]["unit"], "page");
    assert_eq!(items[1]["stage"], "render_preprocess");
    assert_eq!(items[1]["display_stage"], "render");
    assert_eq!(items[1]["lane"], "background");
    assert_eq!(items[1]["substage"], "render_prewarm");
    assert_eq!(items[1]["progress"]["unit"], "step");
}
