use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::error::AppError;
use crate::models::{
    domain::{JobSnapshot, JobStatusKind},
    request::CreateJobInput,
};
use crate::services::providers::{ModelConnection, ModelExecutor, ModelRequest, ModelRequestsApi};
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

    /// 能力令牌由任务运行时在进程内直接发（没有签发接口），测试照样直接找执行器要。
    fn capability(&self, job: &str) -> String {
        self.executor.register_job(job, &profile(), 3600).unwrap()
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

#[tokio::test]
async fn terminal_jobs_reject_submission_without_dispatch() {
    let fixture = Fixture::new("model-api-inactive");
    let token = fixture.capability("job-a");
    for status in [
        JobStatusKind::Succeeded,
        JobStatusKind::Failed,
        JobStatusKind::Canceled,
    ] {
        fixture.save_job("job-a", status);
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

#[tokio::test]
async fn corrupt_job_is_500_without_leaking() {
    // 没有这个任务就发不出令牌（会话表外键指向任务），所以「任务不存在」在验令牌那一步就是 401。
    let fixture = Fixture::new("model-api-job-errors");
    let token = fixture.capability("job-a");
    fixture.sql(
        "UPDATE jobs SET request_json='synthetic-private-storage-marker' WHERE job_id='job-a'",
    );
    let error = fixture.api.submit("job-a", &token, request()).await.unwrap_err();
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
        api.authorize("job-a", "bad"),
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
async fn http_submit_on_a_corrupt_job_is_500_without_leaking() {
    let fixture = Fixture::new("model-api-http-corrupt-job");
    let token = fixture.capability("job-a");
    fixture.sql(
        "UPDATE jobs SET request_json='synthetic-private-storage-marker' WHERE job_id='job-a'",
    );
    let (status, body) = worker_response(&fixture, "job-a", &token, "submit").await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(body["code"], 50000);
    assert!(!body.to_string().contains(PRIVATE_MARKER));
}

async fn raw_submit(
    fixture: &Fixture,
    authorization: Option<String>,
    content_type: Option<&str>,
    body: &str,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/api/v1/internal/model/jobs/job-a/requests");
    if let Some(value) = authorization {
        builder = builder.header("authorization", value);
    }
    if let Some(value) = content_type {
        builder = builder.header("content-type", value);
    }
    let response = build_app(fixture.state.clone())
        .oneshot(builder.body(Body::from(body.to_owned())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    (status, read_json(response).await)
}

#[tokio::test]
async fn http_worker_checks_the_capability_before_reading_the_body() {
    let fixture = Fixture::new("model-api-http-auth-before-body");
    let malformed = [
        (Some("application/json"), "{"),
        (Some("application/json"), r#"{"operation_id":"op-a","unknown_field":1}"#),
        (Some("application/json"), r#"{"operation_id":5}"#),
        (Some("text/plain"), "{}"),
        (None, "{}"),
    ];
    for authorization in [None, Some("Bearer bad".to_owned()), Some(format!("Bearer {}", "0".repeat(64)))] {
        for (content_type, body) in malformed {
            let (status, payload) =
                raw_submit(&fixture, authorization.clone(), content_type, body).await;
            assert_eq!(status, StatusCode::UNAUTHORIZED, "{authorization:?} {body}: {payload}");
            assert_eq!(payload["code"], 40100);
            assert_eq!(payload["error"]["code"], "UNAUTHORIZED");
            // 没有有效令牌就不告诉调用方请求体哪里写错了。
            assert!(!payload.to_string().contains("unknown_field"), "{payload}");
        }
    }
}

#[tokio::test]
async fn http_worker_body_errors_use_the_api_error_envelope() {
    let fixture = Fixture::new("model-api-http-body-envelope");
    let token = Some(format!("Bearer {}", fixture.capability("job-a")));
    for (content_type, body, status, code, stable) in [
        (Some("application/json"), "{", StatusCode::BAD_REQUEST, 40000, "BAD_REQUEST"),
        (
            Some("application/json"),
            r#"{"operation_id":"op-a","unknown_field":"synthetic-private-storage-marker"}"#,
            StatusCode::BAD_REQUEST,
            40000,
            "BAD_REQUEST",
        ),
        (
            Some("application/json"),
            r#"{"operation_id":"synthetic-private-storage-marker","unit_id":7}"#,
            StatusCode::UNPROCESSABLE_ENTITY,
            42200,
            "UNPROCESSABLE_ENTITY",
        ),
        (Some("text/plain"), "{}", StatusCode::UNSUPPORTED_MEDIA_TYPE, 41500, "UNSUPPORTED_MEDIA_TYPE"),
        (None, "{}", StatusCode::UNSUPPORTED_MEDIA_TYPE, 41500, "UNSUPPORTED_MEDIA_TYPE"),
    ] {
        let (actual, payload) = raw_submit(&fixture, token.clone(), content_type, body).await;
        assert_eq!(actual, status, "{body}: {payload}");
        assert_eq!(payload["code"], code, "{payload}");
        assert_eq!(payload["error"]["code"], stable, "{payload}");
        assert_eq!(payload["error"]["http_status"], status.as_u16());
        // 不回显请求里的值，只在不认识的字段时带字段名。
        assert!(!payload.to_string().contains(PRIVATE_MARKER), "{payload}");
    }
    let (_, payload) = raw_submit(
        &fixture,
        token.clone(),
        Some("application/json"),
        r#"{"operation_id":"op-a","unknown_field":1}"#,
    )
    .await;
    assert!(payload["message"]
        .as_str()
        .unwrap()
        .starts_with("unknown field `unknown_field`"));

    // 写对了的请求体能过解析、走到任务状态检查（这里任务已结束，409；不真的发上游请求）。
    fixture.save_job("job-a", JobStatusKind::Succeeded);
    let (status, payload) = raw_submit(
        &fixture,
        token,
        Some("application/json; charset=utf-8"),
        &serde_json::to_string(&request()).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["code"], 40900);
}
