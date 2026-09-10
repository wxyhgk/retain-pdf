use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobFailureInfo, JobSnapshot, JobStatusKind};

use crate::api_tests::jobs_common::{read_json, test_state};

#[tokio::test]
async fn job_events_route_prefers_formal_failure_fields() {
    let state = test_state("events-formal-failure");
    let mut job = JobSnapshot::new(
        "job-route-events-formal-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.replace_failure_info(Some(JobFailureInfo {
        stage: "translation".to_string(),
        category: "upstream_timeout".to_string(),
        code: Some("timeout_504".to_string()),
        failed_stage: Some("translation_prepare".to_string()),
        failure_code: Some("upstream_timeout".to_string()),
        failure_category: Some("timeout".to_string()),
        provider_stage: Some("llm_request".to_string()),
        provider_code: Some("timeout_504".to_string()),
        summary: "请求超时".to_string(),
        root_cause: Some("LLM upstream timed out".to_string()),
        retryable: true,
        upstream_host: Some("api.deepseek.com".to_string()),
        provider: Some("deepseek".to_string()),
        suggestion: Some("稍后重试".to_string()),
        last_log_line: Some("timeout".to_string()),
        raw_excerpt: Some("deadline exceeded".to_string()),
        raw_error_excerpt: Some("deadline exceeded".to_string()),
        raw_diagnostic: None,
        ai_diagnostic: None,
    }));
    state.db.save_job(&job).expect("save job");
    state
        .db
        .append_event(
            &job.job_id,
            "error",
            Some("failed".to_string()),
            None,
            None,
            None,
            "failure_classified",
            Some("failure_classified".to_string()),
            "",
            None,
            None,
            Some(json!({
                "stage": "translation",
                "category": "upstream_timeout",
                "code": "timeout_504",
                "summary": "请求超时"
            })),
            Some(0),
            Some(100),
        )
        .expect("append failure event");
    state
        .db
        .append_event(
            &job.job_id,
            "error",
            Some("failed".to_string()),
            None,
            None,
            None,
            "job_terminal",
            Some("job_terminal".to_string()),
            "",
            None,
            None,
            Some(json!({
                "status": "failed"
            })),
            Some(0),
            Some(120),
        )
        .expect("append terminal event");

    let app = build_app(state.clone());
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}/events", job.job_id))
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
        .expect("items array");
    let failure_item = items
        .iter()
        .find(|item| item["event"] == "failure_classified")
        .expect("failure event");
    assert_eq!(failure_item["stage"], "failed");
    assert!(failure_item["display_stage"].is_null());
    assert_eq!(
        failure_item["payload"]["failure_stage"],
        "translation_prepare"
    );
    assert_eq!(failure_item["provider"], "deepseek");
    assert_eq!(failure_item["provider_stage"], "llm_request");
    assert_eq!(
        failure_item["payload"]["failed_stage"],
        "translation_prepare"
    );
    assert_eq!(failure_item["payload"]["failure_code"], "upstream_timeout");
    assert_eq!(failure_item["payload"]["failure_category"], "timeout");
    assert_eq!(failure_item["payload"]["provider_code"], "timeout_504");

    let terminal_item = items
        .iter()
        .find(|item| item["event"] == "job_terminal")
        .expect("terminal event");
    assert_eq!(terminal_item["stage"], "failed");
    assert!(terminal_item["display_stage"].is_null());
    assert_eq!(
        terminal_item["payload"]["failure_stage"],
        "translation_prepare"
    );
    assert_eq!(terminal_item["provider"], "deepseek");
    assert_eq!(terminal_item["provider_stage"], "llm_request");
    assert_eq!(terminal_item["payload"]["status"], "failed");
    assert_eq!(
        terminal_item["payload"]["failed_stage"],
        "translation_prepare"
    );
    assert_eq!(terminal_item["payload"]["failure_code"], "upstream_timeout");
    assert_eq!(terminal_item["payload"]["failure_category"], "timeout");
}

#[tokio::test]
async fn failed_job_events_include_contract_readiness_payload() {
    let state = test_state("events-contracts");
    let job_id = "job-route-events-contracts";
    let job_root: PathBuf = state.config.data_root.join("jobs").join(job_id);
    let source_pdf = job_root.join("source/input.pdf");
    let translations_dir = job_root.join("translated");
    fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("source dir");
    fs::create_dir_all(&translations_dir).expect("translations dir");
    fs::write(&source_pdf, b"%PDF").expect("source pdf");

    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().to_string()),
        source_pdf: Some(source_pdf.to_string_lossy().to_string()),
        translations_dir: Some(translations_dir.to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
    state
        .db
        .append_event(
            &job.job_id,
            "error",
            Some("failed".to_string()),
            None,
            None,
            None,
            "job_terminal",
            Some("job_terminal".to_string()),
            "任务进入终态 failed",
            None,
            None,
            Some(json!({"status": "failed"})),
            Some(0),
            Some(120),
        )
        .expect("append terminal event");

    let app = build_app(state.clone());
    let response = app
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
    let events_json = read_json(response).await;
    let terminal_item = events_json["data"]["items"]
        .as_array()
        .expect("items")
        .iter()
        .find(|item| item["event"] == "job_terminal")
        .expect("terminal event");
    assert_eq!(
        terminal_item["payload"]["contracts"]["schema_version"],
        "job_stage_contracts.v1"
    );
    let stages = terminal_item["payload"]["contracts"]["stages"]
        .as_array()
        .expect("contract stages");
    let translation_stage = stages
        .iter()
        .find(|item| item["stage"] == "translation_ready_for_render")
        .expect("translation stage");
    assert_eq!(translation_stage["ready"], false);
    let manifest = translation_stage["artifacts"]
        .as_array()
        .expect("artifacts")
        .iter()
        .find(|item| item["artifact_key"] == "translation_manifest_json")
        .expect("manifest artifact");
    assert_eq!(manifest["ready"], false);
}
