use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::error::AppError;
use crate::models::{
    domain::{JobSnapshot, JobStatusKind},
    request::CreateJobInput,
};
use crate::services::model_executor::ModelExecutor;
use crate::services::model_requests_api::{ModelConnection, ModelRequest, ModelRequestsApi};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

const PRIVATE_MARKER: &str = "synthetic-private-storage-marker";

struct Fixture {
    state: crate::AppState,
    api: ModelRequestsApi,
    executor: Arc<ModelExecutor>,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let mut state = test_state(name);
        let executor =
            Arc::new(ModelExecutor::new(state.db.clone(), state.config.data_root.clone()).unwrap());
        state.model_executor = Some(executor.clone());
        let api = ModelRequestsApi::new(state.db.clone(), Some(executor.clone()));
        let fixture = Self {
            state,
            api,
            executor,
        };
        fixture.save_job("job-a", JobStatusKind::Queued);
        fixture.save_job("job-b", JobStatusKind::Running);
        fixture
    }

    fn save_job(&self, id: &str, status: JobStatusKind) {
        let p = profile();
        let input: CreateJobInput = serde_json::from_value(json!({"translation": {
            "model": p.model, "base_url": p.base_url,
            "credential_ref": p.credential_ref, "workers": p.concurrency,
            "execution_connection": p
        }}))
        .unwrap();
        let mut job = JobSnapshot::new(id.into(), input, vec![]);
        job.status = status;
        self.state.db.save_job(&job).unwrap();
    }

    fn sql(&self, sql: &str) {
        rusqlite::Connection::open(&self.state.config.jobs_db_path)
            .unwrap()
            .execute_batch(sql)
            .unwrap();
    }

    fn capability(&self, job: &str) -> String {
        self.api.issue(job, profile()).unwrap()["capability"]
            .as_str()
            .unwrap()
            .to_owned()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        // test_state creates a unique temporary root for this fixture only.
        let _ = std::fs::remove_dir_all(&self.state.config.project_root);
    }
}

fn profile() -> ModelConnection {
    serde_json::from_value(json!({
        "id": "qwen-main", "revision": 1, "provider": "qwen",
        "base_url": "https://example.org/v1", "model": "qwen3.8-flash",
        "credential_ref": "cred_test", "concurrency": 2,
        "thinking": "auto", "stream": false, "allow_private_endpoint": true,
        "deadlines": {"queue_ms":500,"connect_ms":100,"idle_ms":200,"total_ms":700}
    }))
    .unwrap()
}

fn request() -> ModelRequest {
    serde_json::from_value(json!({
        "operation_id":"op-a", "unit_id":"unit-a", "purpose":"primary",
        "messages":[{"role":"user","content":"offline test source"}],
        "temperature":0.2, "max_tokens":1024
    }))
    .unwrap()
}

#[test]
fn issue_rejects_every_changed_snapshot_field() {
    let fixture = Fixture::new("model-api-frozen-profile");
    for (field, replacement) in [
        ("id", json!("other")),
        ("revision", json!(2)),
        ("provider", json!("openai_compatible")),
        ("base_url", json!("https://other.example/v1")),
        ("model", json!("other-model")),
        ("credential_ref", json!("cred_other")),
        ("concurrency", json!(3)),
        ("thinking", json!("on")),
        ("stream", json!(true)),
        ("allow_private_endpoint", json!(false)),
    ] {
        let mut value = serde_json::to_value(profile()).unwrap();
        value[field] = replacement;
        let changed = serde_json::from_value(value).unwrap();
        assert!(
            matches!(
                fixture.api.issue("job-a", changed),
                Err(AppError::Conflict(_))
            ),
            "{field}"
        );
    }
    for field in ["queue_ms", "connect_ms", "idle_ms", "total_ms"] {
        let mut value = serde_json::to_value(profile()).unwrap();
        value["deadlines"][field] = json!(value["deadlines"][field].as_u64().unwrap() + 1);
        assert!(
            matches!(
                fixture
                    .api
                    .issue("job-a", serde_json::from_value(value).unwrap()),
                Err(AppError::Conflict(_))
            ),
            "{field}"
        );
    }
    assert_eq!(fixture.capability("job-a").len(), 64);
}

#[test]
fn issue_rejects_legacy_fields_that_disagree_with_matching_snapshot() {
    let fixture = Fixture::new("model-api-frozen-legacy");
    for field in ["model", "base_url", "credential_ref", "workers"] {
        fixture.save_job("job-a", JobStatusKind::Queued);
        let mut job = fixture.state.db.get_job("job-a").unwrap();
        match field {
            "model" => job.request_payload.translation.model = "other-model".into(),
            "base_url" => {
                job.request_payload.translation.base_url = "https://other.example/v1".into()
            }
            "credential_ref" => {
                job.request_payload.translation.credential_ref = "cred_other".into()
            }
            _ => job.request_payload.translation.workers = 3,
        }
        fixture.state.db.save_job(&job).unwrap();
        assert!(
            matches!(
                fixture.api.issue("job-a", profile()),
                Err(AppError::Conflict(_))
            ),
            "{field}"
        );
    }
}

#[tokio::test]
async fn terminal_jobs_reject_issuance_and_submission_without_dispatch() {
    let fixture = Fixture::new("model-api-inactive");
    let token = fixture.capability("job-a");
    for status in [
        JobStatusKind::Succeeded,
        JobStatusKind::Failed,
        JobStatusKind::Canceled,
    ] {
        fixture.save_job("job-a", status);
        assert!(matches!(
            fixture.api.issue("job-a", profile()),
            Err(AppError::Conflict(_))
        ));
        assert!(matches!(
            fixture.api.submit("job-a", &token, request()).await,
            Err(AppError::Conflict(_))
        ));
        assert!(fixture
            .executor
            .status("job-a", &token, "op-a")
            .unwrap()
            .is_none());
    }
}

#[test]
fn missing_job_is_404_but_corrupt_job_is_500() {
    let fixture = Fixture::new("model-api-job-errors");
    assert!(matches!(
        fixture.api.issue("missing", profile()),
        Err(AppError::NotFound(_))
    ));
    fixture.sql(
        "UPDATE jobs SET request_json='synthetic-private-storage-marker' WHERE job_id='job-a'",
    );
    let error = fixture.api.issue("job-a", profile()).unwrap_err();
    assert!(matches!(error, AppError::Internal(_)));
    assert!(!error.to_string().contains(PRIVATE_MARKER));
}

#[tokio::test]
async fn invalid_token_precedes_job_lookup_even_with_corrupt_jobs_table() {
    let fixture = Fixture::new("model-api-auth-order");
    fixture.sql("DROP TABLE jobs");
    for job in ["job-a", "missing"] {
        assert!(matches!(
            fixture.api.submit(job, &"0".repeat(64), request()).await,
            Err(AppError::Unauthorized(_))
        ));
    }
}

#[tokio::test]
async fn disabled_executor_returns_503_for_all_facade_methods() {
    let fixture = Fixture::new("model-api-disabled");
    let api = ModelRequestsApi::new(fixture.state.db.clone(), None);
    assert!(matches!(
        api.issue("job-a", profile()),
        Err(AppError::ServiceUnavailable(_))
    ));
    assert!(matches!(
        api.submit("job-a", "bad", request()).await,
        Err(AppError::ServiceUnavailable(_))
    ));
    assert!(matches!(
        api.status("job-a", "bad", "op-a"),
        Err(AppError::ServiceUnavailable(_))
    ));
    assert!(matches!(
        api.cancel("job-a", "bad", "op-a"),
        Err(AppError::ServiceUnavailable(_))
    ));
}

async fn worker_response(
    fixture: &Fixture,
    job: &str,
    token: &str,
    action: &str,
) -> (StatusCode, Value) {
    let (method, path, body) = match action {
        "submit" => (
            "POST",
            format!("/api/v1/internal/model/jobs/{job}/requests"),
            serde_json::to_vec(&request()).unwrap(),
        ),
        "cancel" => (
            "POST",
            format!("/api/v1/internal/model/jobs/{job}/requests/op-a/cancel"),
            vec![],
        ),
        _ => (
            "GET",
            format!("/api/v1/internal/model/jobs/{job}/requests/op-a"),
            vec![],
        ),
    };
    let response = build_app(fixture.state.clone())
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    (status, read_json(response).await)
}

#[tokio::test]
async fn http_worker_capabilities_are_scoped_expiring_and_required() {
    let fixture = Fixture::new("model-api-http-capability");
    let token = fixture.capability("job-a");
    for action in ["submit", "status", "cancel"] {
        for (job, invalid) in [
            ("job-a", "bad".to_owned()),
            ("job-a", "0".repeat(64)),
            ("job-b", token.clone()),
        ] {
            let (status, _) = worker_response(&fixture, job, &invalid, action).await;
            assert_eq!(status, StatusCode::UNAUTHORIZED, "{action} {job}");
        }
    }
    let (status, _) = worker_response(&fixture, "job-a", &token, "status").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    fixture.sql("UPDATE model_sessions SET expires_at=0 WHERE job_id='job-a'");
    for action in ["submit", "status", "cancel"] {
        let (status, _) = worker_response(&fixture, "job-a", &token, action).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{action}");
    }
}

#[tokio::test]
async fn http_storage_faults_are_500_not_401_and_do_not_leak() {
    for fault in ["profile", "sessions_table", "operations_table"] {
        let fixture = Fixture::new(&format!("model-api-http-storage-{fault}"));
        let token = fixture.capability("job-a");
        match fault {
            "profile" => fixture.sql("UPDATE model_sessions SET profile_json='synthetic-private-storage-marker' WHERE job_id='job-a'"),
            "sessions_table" => fixture.sql("ALTER TABLE model_sessions RENAME TO synthetic_private_storage_marker"),
            _ => fixture.sql("ALTER TABLE model_operations RENAME TO synthetic_private_storage_marker"),
        }
        for action in ["submit", "status", "cancel"] {
            let (status, body) = worker_response(&fixture, "job-a", &token, action).await;
            assert_eq!(
                status,
                StatusCode::INTERNAL_SERVER_ERROR,
                "{fault} {action}: {body}"
            );
            assert!(!body.to_string().contains(PRIVATE_MARKER));
            assert!(!body
                .to_string()
                .contains("synthetic_private_storage_marker"));
        }
    }
}

#[tokio::test]
async fn http_launcher_distinguishes_missing_corrupt_and_unauthorized_jobs() {
    let fixture = Fixture::new("model-api-http-launcher");
    let token = fixture.capability("job-a");
    fixture.sql(
        "UPDATE jobs SET request_json='synthetic-private-storage-marker' WHERE job_id='job-a'",
    );
    for (job, key, expected) in [
        ("missing", "test-key", StatusCode::NOT_FOUND),
        ("job-a", "test-key", StatusCode::INTERNAL_SERVER_ERROR),
        ("job-a", "wrong-key", StatusCode::UNAUTHORIZED),
    ] {
        let response = build_app(fixture.state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/internal/model/jobs/{job}/capability"))
                    .header("x-api-key", key)
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&profile()).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
        let body = read_json(response).await;
        assert!(!body.to_string().contains(PRIVATE_MARKER));
    }
    let (status, body) = worker_response(&fixture, "job-a", &token, "submit").await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(!body.to_string().contains(PRIVATE_MARKER));
}
