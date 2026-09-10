use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

#[tokio::test]
async fn job_detail_route_ignores_background_render_prewarm_for_main_stage() {
    let state = test_state("detail-ignores-background-prewarm");
    let mut job = JobSnapshot::new(
        "job-route-background-prewarm".to_string(),
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
            r#"{"job_id":"job-route-background-prewarm","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 2/5 批翻译","event_type":"stage_progress","message":"已完成第 2/5 批翻译","progress_current":2,"progress_total":5,"payload":{}}"#,
            "\n",
            r#"{"job_id":"job-route-background-prewarm","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"rendering","substage":"render_prewarm","stage_detail":"渲染预热完成","event_type":"stage_progress","message":"render payload prewarm: ready","progress_current":3,"progress_total":3,"progress_unit":"step","payload":{"render_stage":"payload_prewarm"}}"#,
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
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "batch"
    );
}

#[tokio::test]
async fn job_detail_route_keeps_render_page_progress_over_compile_steps() {
    let state = test_state("detail-render-page-over-compile");
    let mut job = JobSnapshot::new(
        "job-route-render-page-over-compile".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.stage = Some("rendering".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-render-page-over-compile","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","user_stage":"render","stage":"rendering","substage":"render_pages","stage_detail":"正在生成 Typst 页面，第 548/548 页","event_type":"stage_progress","message":"正在生成 Typst 页面，第 548/548 页","progress_current":548,"progress_total":548,"progress_unit":"page","payload":{"render_stage":"typst_source_build"}}"#,
            "\n",
            r#"{"job_id":"job-route-render-page-over-compile","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","user_stage":"render","stage":"rendering","substage":"render_compile","stage_detail":"整本 Typst 渲染编译完成，共 548 页","event_type":"stage_progress","message":"整本 Typst 渲染编译完成，共 548 页","progress_current":4,"progress_total":4,"progress_unit":"step","payload":{"render_stage":"background_typst_compile_done"}}"#,
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
    assert_eq!(detail_json["data"]["stage_snapshot"]["stage"], "rendering");
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage_detail"],
        "整本 Typst 渲染编译完成，共 548 页"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["current"],
        548
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["total"],
        548
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "page"
    );
}
