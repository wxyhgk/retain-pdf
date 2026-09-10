use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};

use super::jobs_common::{read_json, test_state};

fn assert_no_legacy_top_level_stage_fields(data: &serde_json::Value) {
    for key in [
        "display_stage",
        "stage",
        "substage",
        "lane",
        "stage_detail",
        "progress",
        "background_stages",
    ] {
        assert!(
            data.get(key).is_none(),
            "legacy top-level field should be absent: {key}"
        );
    }
}

#[tokio::test]
async fn job_detail_list_and_events_share_pipeline_event_priority() {
    let state = test_state("shared-live-stage-priority");
    let mut job = JobSnapshot::new(
        "job-route-shared-live-stage".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("stale queued detail".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-shared-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 4/9 批翻译","provider":"","provider_stage":"","event":"stage_progress","message":"已完成第 4/9 批翻译","progress_current":4,"progress_total":9,"retry_count":0,"elapsed_ms":900,"payload":{"origin":"python"}}"#,
            "\n",
            r#"{"job_id":"job-route-shared-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1000,"payload":{"artifact_key":"output_pdf"}}"#,
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
    assert_no_legacy_top_level_stage_fields(&detail_json["data"]);
    let detail_stage = &detail_json["data"]["stage_snapshot"];
    assert_eq!(detail_stage["display_stage"], "translation");
    assert_eq!(detail_stage["stage"], "translating");
    assert_eq!(detail_stage["substage"], "translation_batches");
    assert_eq!(detail_stage["lane"], "main");
    assert_eq!(detail_stage["stage_detail"], "已完成第 4/9 批翻译");
    assert_eq!(detail_stage["progress"]["unit"], "batch");
    assert_eq!(detail_stage["progress"]["current"], 4);
    assert_eq!(detail_stage["progress"]["total"], 9);
    assert_eq!(
        detail_json["data"]["stages"]["translation"]["state"],
        "in_progress"
    );

    let list_response = app
        .clone()
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
    let list_item = list_json["data"]["items"]
        .as_array()
        .expect("list items")
        .iter()
        .find(|item| item["job_id"] == "job-route-shared-live-stage")
        .expect("job item");
    assert_no_legacy_top_level_stage_fields(list_item);
    assert_eq!(list_item["stage_snapshot"]["display_stage"], "translation");
    assert_eq!(list_item["stage_snapshot"]["stage"], "translating");
    assert_eq!(
        list_item["stage_snapshot"]["substage"],
        "translation_batches"
    );
    assert_eq!(list_item["stage_snapshot"]["lane"], "main");
    assert_eq!(list_item["stage_snapshot"]["progress"]["unit"], "batch");

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
    let items = events_json["data"]["items"]
        .as_array()
        .expect("events items");
    let stage_progress = items
        .iter()
        .find(|item| item["event"] == "stage_progress")
        .expect("stage_progress event");
    let artifact_published = items
        .iter()
        .find(|item| item["event"] == "artifact_published")
        .expect("artifact_published event");
    assert_eq!(stage_progress["event_type"], "progress");
    assert_eq!(stage_progress["raw_event_type"], "stage_progress");
    assert_eq!(stage_progress["stage"], "translating");
    assert_eq!(stage_progress["display_stage"], "translation");
    assert_eq!(artifact_published["event_type"], "artifact");
    assert_eq!(artifact_published["raw_event_type"], "artifact_published");
    assert_eq!(artifact_published["stage"], "saving");
    assert_eq!(artifact_published["display_stage"], "render");
    assert_eq!(artifact_published["substage"], "render_pages");
}

#[tokio::test]
async fn job_detail_keeps_render_prewarm_as_background_stage() {
    let state = test_state("render-prewarm-background-live-stage");
    let mut job = JobSnapshot::new(
        "job-route-render-prewarm-background".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.stage = Some("translating".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-render-prewarm-background","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"正在翻译第 8/42 批","event":"stage_progress","message":"正在翻译第 8/42 批","progress_current":8,"progress_total":42,"progress_unit":"batch","payload":{"origin":"python"}}"#,
            "\n",
            r#"{"job_id":"job-route-render-prewarm-background","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"rendering","substage":"render_prewarm","stage_detail":"渲染预热完成","event":"stage_progress","message":"render payload prewarm: ready indents=333 geometry=836 elapsed=1.58s","progress_current":2,"progress_total":3,"progress_unit":"step","payload":{"origin":"python"}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let app = build_app(state.clone());
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(response.status(), StatusCode::OK);
    let detail_json = read_json(response).await;
    assert_no_legacy_top_level_stage_fields(&detail_json["data"]);
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["display_stage"],
        "translation"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage"],
        "translating"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["substage"],
        "translation_batches"
    );
    assert_eq!(detail_json["data"]["stage_snapshot"]["lane"], "main");
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "batch"
    );

    let background = detail_json["data"]["background_snapshots"]
        .as_array()
        .expect("background_snapshots")
        .iter()
        .find(|item| item["substage"] == "render_prewarm")
        .expect("render prewarm background stage");
    assert_eq!(background["display_stage"], "render");
    assert_eq!(background["stage"], "rendering");
    assert_eq!(background["lane"], "background");
    assert_eq!(background["progress"]["unit"], "step");
    assert_eq!(background["progress"]["current"], 2);
    assert_eq!(background["progress"]["total"], 3);
}

#[tokio::test]
async fn running_job_detail_does_not_select_premature_done_event_over_active_stage() {
    let state = test_state("running-live-stage-ignores-premature-done");
    let mut job = JobSnapshot::new(
        "job-route-running-ignore-premature-done".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-running-ignore-premature-done","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"ocr_processing","stage_detail":"OCR 第 10/10 页","event":"stage_progress","message":"OCR 第 10/10 页","progress_current":10,"progress_total":10,"progress_unit":"page","payload":{}}"#,
            "\n",
            r#"{"job_id":"job-route-running-ignore-premature-done","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"finished","stage_detail":"任务完成","event":"job_terminal","event_type":"job_terminal","message":"任务进入终态 succeeded","payload":{"status":"succeeded"}}"#,
            "\n",
            r#"{"job_id":"job-route-running-ignore-premature-done","seq":3,"ts":"2026-04-24T01:00:02Z","level":"info","stage":"translating","stage_detail":"正在翻译第 2/8 批","event":"stage_progress","message":"正在翻译第 2/8 批","progress_current":2,"progress_total":8,"progress_unit":"batch","payload":{}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(response.status(), StatusCode::OK);
    let detail_json = read_json(response).await;
    assert_eq!(detail_json["data"]["status"], "running");
    assert_no_legacy_top_level_stage_fields(&detail_json["data"]);
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["display_stage"],
        "translation"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage"],
        "translating"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["substage"],
        "translation_batches"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "batch"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["current"],
        2
    );
}

#[tokio::test]
async fn running_job_detail_prefers_latest_retry_stage_over_old_higher_rank_stage() {
    let state = test_state("running-live-stage-retry-latest-stage");
    let mut job = JobSnapshot::new(
        "job-route-running-retry-latest-stage".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        concat!(
            r#"{"job_id":"job-route-running-retry-latest-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"rendering","stage_detail":"旧运行正在渲染第 8/10 页","event":"stage_progress","message":"旧运行正在渲染第 8/10 页","progress_current":8,"progress_total":10,"progress_unit":"page","payload":{"attempt":1}}"#,
            "\n",
            r#"{"job_id":"job-route-running-retry-latest-stage","seq":2,"ts":"2026-04-24T01:01:00Z","level":"info","stage":"translating","stage_detail":"重试正在翻译第 1/5 批","event":"stage_progress","message":"重试正在翻译第 1/5 批","progress_current":1,"progress_total":5,"progress_unit":"batch","payload":{"attempt":2}}"#,
            "\n"
        ),
    )
    .expect("write pipeline events");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(response.status(), StatusCode::OK);
    let detail_json = read_json(response).await;
    assert_eq!(detail_json["data"]["status"], "running");
    assert_no_legacy_top_level_stage_fields(&detail_json["data"]);
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["display_stage"],
        "translation"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage"],
        "translating"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["stage_detail"],
        "重试正在翻译第 1/5 批"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["unit"],
        "batch"
    );
    assert_eq!(
        detail_json["data"]["stage_snapshot"]["progress"]["current"],
        1
    );
}

#[tokio::test]
async fn terminal_job_detail_uses_status_not_done_display_stage() {
    let state = test_state("terminal-live-stage-has-null-snapshot");
    let mut job = JobSnapshot::new(
        "job-route-terminal-null-stage-snapshot".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Succeeded;
    job.stage = Some("finished".to_string());
    let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    fs::write(
        job_root.join("logs").join("pipeline_events.jsonl"),
        r#"{"job_id":"job-route-terminal-null-stage-snapshot","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"finished","stage_detail":"任务完成","event":"job_terminal","event_type":"job_terminal","message":"任务进入终态 succeeded","payload":{"status":"succeeded"}}"#,
    )
    .expect("write pipeline events");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(response.status(), StatusCode::OK);
    let detail_json = read_json(response).await;
    assert_eq!(detail_json["data"]["status"], "succeeded");
    assert_no_legacy_top_level_stage_fields(&detail_json["data"]);
    assert!(detail_json["data"]["stage_snapshot"].is_null());
    assert_eq!(detail_json["data"]["stages"]["ocr"]["state"], "completed");
    assert_eq!(
        detail_json["data"]["stages"]["translation"]["state"],
        "completed"
    );
    assert_eq!(
        detail_json["data"]["stages"]["render"]["state"],
        "completed"
    );
}
