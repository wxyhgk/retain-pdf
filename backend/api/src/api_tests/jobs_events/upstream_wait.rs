//! 服务商限流等待：worker 的阶段观察 payload 带 upstream_wait 时，任务状态的 stage_snapshot.upstream_wait 带出来，
//! 等待结束（upstream_wait=null）后字段消失；进度数字不受影响。
use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::job_view_contract::{assert_definition, contract};
use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::db::PipelineStageObservation;
use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

fn observation(seq: u64, message: &str, payload: Value) -> PipelineStageObservation {
    PipelineStageObservation {
        producer_seq: seq,
        producer_ts: format!("2026-11-23T00:00:0{seq}Z"),
        event_type: "stage_progress".to_string(),
        raw_stage: "translating".to_string(),
        substage: Some("translation_batches".to_string()),
        stage_detail: Some("已翻译 3/8 块".to_string()),
        message: message.to_string(),
        provider: None,
        provider_stage: None,
        progress_current: Some(3),
        progress_total: Some(8),
        progress_unit: Some("block".to_string()),
        payload,
    }
}

async fn get(app: axum::Router, uri: &str) -> Value {
    let response = app
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await
}

#[tokio::test]
async fn upstream_wait_reaches_stage_snapshot_and_clears_after_the_wait() {
    let state = test_state("upstream-wait-snapshot");
    let mut job = JobSnapshot::new(
        "job-upstream-wait".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    let job_root = state.config.data_root.join("jobs").join(&job.job_id);
    fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
    job.artifacts
        .get_or_insert_with(crate::models::JobArtifacts::default)
        .job_root = Some(job_root.to_string_lossy().to_string());
    state.db.save_job(&job).expect("save job");
    let mut cursor = state
        .db
        .acquire_pipeline_attempt(&job.job_id, "worker-a", "translate", 1)
        .expect("acquire attempt");
    let wait = json!({
        "provider": "deepseek", "http_status": 429, "reason": "rate_limited",
        "code": "rate_limit_exceeded", "retry_after_s": 30.0, "wait_source": "retry_after",
        "attempt": 1, "max_attempts": 2,
        "started_at": "2026-11-23T00:00:02.000Z", "until": "2026-11-23T00:00:32.000Z"
    });
    for (seq, message, payload) in [
        (1, "已翻译 3/8 块", json!({"progress_unit": "block"})),
        (
            2,
            "服务商限流，等待中（deepseek HTTP 429，约 30 秒后重试）",
            json!({"progress_unit": "block", "upstream_wait": wait, "upstream_wait_transition": "started"}),
        ),
    ] {
        cursor = state
            .db
            .observe_pipeline_stage(&cursor, "translate", 1, true, &observation(seq, message, payload))
            .expect("commit observation");
    }

    let detail = get(build_app(state.clone()), &format!("/api/v1/jobs/{}", job.job_id)).await;
    let snapshot = &detail["data"]["stage_snapshot"];
    assert_eq!(snapshot["upstream_wait"], wait);
    assert_eq!(snapshot["stage_detail"], "已翻译 3/8 块");
    assert_eq!(snapshot["progress"]["current"], 3);
    assert_eq!(snapshot["progress"]["total"], 8);
    assert_definition(snapshot, &contract("job-status.v1.schema.json"), "JobStageSnapshotView", "stage_snapshot");
    let list = get(build_app(state.clone()), "/api/v1/jobs?include_live_stage=true").await;
    let item = list["data"]["items"]
        .as_array()
        .expect("items")
        .iter()
        .find(|item| item["job_id"] == job.job_id)
        .expect("listed job");
    assert_eq!(item["stage_snapshot"]["upstream_wait"]["provider"], "deepseek");

    let events = get(
        build_app(state.clone()),
        &format!("/api/v1/jobs/{}/progress/events", job.job_id),
    )
    .await;
    let started = events["data"]["items"]
        .as_array()
        .expect("events")
        .iter()
        .find(|item| item["payload"]["observation"]["upstream_wait_transition"] == "started")
        .expect("wait start event");
    assert_eq!(started["payload"]["observation"]["upstream_wait"], wait);
    assert_eq!(started["progress"]["current"], 3);

    state
        .db
        .observe_pipeline_stage(
            &cursor,
            "translate",
            1,
            true,
            &observation(
                3,
                "服务商限流等待结束，继续请求",
                json!({"progress_unit": "block", "upstream_wait": null, "upstream_wait_transition": "ended"}),
            ),
        )
        .expect("commit wait end");
    let detail = get(build_app(state.clone()), &format!("/api/v1/jobs/{}", job.job_id)).await;
    let snapshot = &detail["data"]["stage_snapshot"];
    assert!(snapshot.get("upstream_wait").is_none(), "wait cleared: {snapshot}");
    assert_eq!(snapshot["progress"]["current"], 3);
}
