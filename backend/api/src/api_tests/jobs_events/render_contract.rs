use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

use crate::api_tests::jobs_common::{read_json, test_state};

#[tokio::test]
async fn job_events_route_keeps_rendering_page_progress_events() {
    let state = test_state("events-render-progress");
    let mut job = JobSnapshot::new(
        "job-route-render-progress".to_string(),
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
            r#"{"job_id":"job-route-render-progress","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"rendering","stage_detail":"正在渲染第 1/3 页","provider":"","provider_stage":"","event_type":"stage_progress","message":"正在渲染第 1/3 页","progress_current":1,"progress_total":3,"retry_count":0,"elapsed_ms":1000,"payload":{"page_index":0,"render_stage":"book_overlay"}}"#,
            "\n",
            r#"{"job_id":"job-route-render-progress","seq":2,"ts":"2026-04-24T01:00:01Z","level":"error","stage":"failed","stage_detail":"渲染失败","provider":"","provider_stage":"","event_type":"job_terminal","message":"任务进入终态 failed","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1100,"payload":{}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let app = build_app(state.clone());
    let detail_response = app
        .clone()
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
    assert_eq!(detail_json["data"]["stage_snapshot"]["stage"], "rendering");
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage_detail"],
        "正在渲染第 1/3 页"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["current"],
        1
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["total"],
        3
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "page"
    );

    let events_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("events request"),
        )
        .await
        .expect("events response");
    assert_eq!(events_response.status(), StatusCode::OK);
    let events_json = read_json(events_response).await;
    let events = events_json["data"]["items"]
        .as_array()
        .expect("events items");
    let render_event = events
        .iter()
        .find(|item| item["raw_event_type"] == "stage_progress")
        .expect("render progress event");
    assert_eq!(render_event["stage"], "rendering");
    assert_eq!(render_event["display_stage"], "render");
    assert_eq!(render_event["lane"], "main");
    assert!(render_event.get("user_stage").is_none());
    assert_eq!(render_event["substage"], "render_pages");
    assert_eq!(render_event["event_type"], "progress");
    assert_eq!(render_event["progress"]["unit"], "page");
}

#[tokio::test]
async fn job_events_route_canonicalizes_render_prewarm_even_when_user_stage_is_stale() {
    let state = test_state("events-render-prewarm-canonical");
    let mut job = JobSnapshot::new(
        "job-route-render-prewarm-canonical".to_string(),
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
        r#"{"job_id":"job-route-render-prewarm-canonical","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","user_stage":"translation","stage":"rendering","substage":"render_prewarm","stage_detail":"渲染预热完成","event_type":"stage_progress","message":"render payload prewarm: ready indents=333 geometry=836 elapsed=1.58s","progress_current":2,"progress_total":3,"progress_unit":"step","payload":{"render_stage":"payload_prewarm"}}"#,
    )
    .expect("write pipeline events");

    let app = build_app(state.clone());
    let events_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("events request"),
        )
        .await
        .expect("events response");
    assert_eq!(events_response.status(), StatusCode::OK);
    let events_json = read_json(events_response).await;
    let item = events_json["data"]["items"]
        .as_array()
        .expect("events items")
        .first()
        .expect("event");
    assert_eq!(item["stage"], "rendering");
    assert_eq!(item["display_stage"], "render");
    assert_eq!(item["lane"], "background");
    assert!(item.get("user_stage").is_none());
    assert_eq!(item["substage"], "render_prewarm");
    assert_eq!(item["event_type"], "progress");
    assert_eq!(item["raw_event_type"], "stage_progress");
    assert_eq!(item["progress"]["unit"], "step");
    assert_eq!(item["raw"]["source_kind"], "pipeline_jsonl");
    assert_eq!(item["payload"]["raw_user_stage"], "translation");
    assert_eq!(item["payload"]["raw_stage"], "rendering");
}
