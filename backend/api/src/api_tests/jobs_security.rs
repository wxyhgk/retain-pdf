use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

use super::jobs_common::{read_json, test_state};

#[tokio::test]
async fn job_detail_and_events_routes_redact_secrets() {
    let state = test_state("detail-events-redaction");
    let mut input = CreateJobInput::default();
    input.translation.api_key = "sk-route-secret".to_string();
    input.ocr.mineru_token = "mineru-route-secret".to_string();
    let mut job = JobSnapshot::new(
        "job-route-redaction".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.error = Some("upstream said sk-route-secret".to_string());
    job.log_tail = vec!["mineru-route-secret appeared in log".to_string()];
    state.db.save_job(&job).expect("save job");
    state
        .db
        .append_event(
            &job.job_id,
            "error",
            Some("failed".to_string()),
            Some("failure classified".to_string()),
            Some("mineru".to_string()),
            Some("provider_failed".to_string()),
            "failure_classified",
            Some("failure_classified".to_string()),
            "message contains sk-route-secret",
            Some(1),
            Some(2),
            Some(json!({
                "api_key": "sk-route-secret",
                "note": "mineru-route-secret in payload"
            })),
            Some(0),
            Some(1234),
        )
        .expect("append event");

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
    assert_eq!(
        detail_json["data"]["request_payload"]["translation"]["api_key"],
        ""
    );
    assert_eq!(
        detail_json["data"]["request_payload"]["ocr"]["mineru_token"],
        ""
    );
    assert_eq!(detail_json["data"]["error"], "upstream said [REDACTED]");
    assert_eq!(
        detail_json["data"]["log_tail"][0],
        "[REDACTED] appeared in log"
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
    assert_eq!(
        events_json["data"]["items"][0]["message"],
        "message contains [REDACTED]"
    );
    assert_eq!(events_json["data"]["items"][0]["event_type"], "error");
    assert_eq!(
        events_json["data"]["items"][0]["raw_event_type"],
        "failure_classified"
    );
    assert_eq!(events_json["data"]["items"][0]["provider"], "mineru");
    assert_eq!(
        events_json["data"]["items"][0]["provider_stage"],
        "provider_failed"
    );
    assert_eq!(
        events_json["data"]["items"][0]["stage_detail"],
        "failure classified"
    );
    assert_eq!(events_json["data"]["items"][0]["payload"]["api_key"], "");
    assert_eq!(
        events_json["data"]["items"][0]["payload"]["note"],
        "[REDACTED] in payload"
    );
}
