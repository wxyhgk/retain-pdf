use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::test_state;
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind};

fn seed_job(state: &crate::AppState, job_id: &str, status: JobStatusKind, markdown: Option<&str>) {
    let job_root = state.config.output_root.join(job_id);
    if let Some(content) = markdown {
        let markdown_dir = job_root.join("md");
        fs::create_dir_all(&markdown_dir).expect("create markdown dir");
        fs::write(markdown_dir.join("full.md"), content).expect("write markdown");
    }

    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.status = status;
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
}

#[tokio::test]
async fn reader_ai_chat_requires_completed_job() {
    let state = test_state("reader-ai-chat-running");
    seed_job(
        &state,
        "reader-ai-running",
        JobStatusKind::Running,
        Some("# Intro\n\nBody"),
    );

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/reader-ai-running/reader/ai/chat")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"message":"summary"}"#))
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn reader_ai_chat_reports_missing_markdown() {
    let state = test_state("reader-ai-chat-missing-md");
    seed_job(&state, "reader-ai-no-md", JobStatusKind::Succeeded, None);

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/reader-ai-no-md/reader/ai/chat")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"message":"summary"}"#))
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn reader_ai_chat_rejects_base_url_override_without_request_key() {
    let state = test_state("reader-ai-chat-base-url-without-key");
    seed_job(
        &state,
        "reader-ai-base-url-no-key",
        JobStatusKind::Succeeded,
        Some("# Intro\n\nBody"),
    );

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/reader-ai-base-url-no-key/reader/ai/chat")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"message":"summary","base_url":"https://attacker.example/v1"}"#,
                ))
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
