use super::*;
use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicUsize, Ordering};

struct Fixture {
    root: PathBuf,
    executor: Arc<ModelExecutor>,
}
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "retain-model-test-{}-{:x}",
            std::process::id(),
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("secrets")).unwrap();
        let vault = root.join("secrets/credentials.json");
        std::fs::write(&vault,serde_json::to_vec(&json!({"schema":"retainpdf_credential_vault_v1","credentials":{"cred_test":{"kind":"translation_api_key","provider":"qwen","secret":"test-secret-not-a-real-key"}}})).unwrap()).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&vault, std::fs::Permissions::from_mode(0o600)).unwrap();
        }
        let db = Arc::new(Db::new(root.join("jobs.db"), root.clone()));
        db.init().unwrap();
        for job_id in ["j", "job-a"] {
            let input: crate::models::request::CreateJobInput =
                serde_json::from_value(json!({})).unwrap();
            db.save_job(&crate::models::domain::JobSnapshot::new(
                job_id.into(),
                input,
                vec![],
            ))
            .unwrap();
        }
        let executor = Arc::new(ModelExecutor::new(db, root.clone()).unwrap());
        Self { root, executor }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn profile(url: &str) -> ModelConnection {
    ModelConnection {
        id: "qwen-main".into(),
        revision: 1,
        provider: Provider::Qwen,
        base_url: url.into(),
        model: "qwen3.8-flash".into(),
        credential_ref: "cred_test".into(),
        concurrency: 2,
        thinking: Thinking::Auto,
        stream: Some(false),
        allow_private_endpoint: true,
        deadlines: Deadlines {
            queue_ms: 500,
            connect_ms: 100,
            idle_ms: 200,
            total_ms: 700,
        },
    }
}
fn request(id: &str) -> ModelRequest {
    ModelRequest {
        operation_id: id.into(),
        unit_id: id.into(),
        purpose: "primary".into(),
        messages: vec![Message {
            role: "user".into(),
            content: "sensitive source text".into(),
        }],
        temperature: 0.2,
        max_tokens: Some(1024),
        response_format: None,
    }
}
async fn server(app: Router) -> (String, tokio::task::JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{addr}/v1"), task)
}
async fn terminal(executor: &ModelExecutor, job: &str, token: &str, id: &str) -> ModelOperation {
    tokio::time::timeout(Duration::from_secs(4), async {
        loop {
            let op = executor.status(job, token, id).unwrap().unwrap();
            if !matches!(op.status.as_str(), "queued" | "running") {
                return op;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap()
}
fn successful() -> Value {
    json!({"choices":[{"message":{"content":"translated"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":9,"completion_tokens_details":{"reasoning_tokens":3}}})
}

#[test]
fn provider_policy_is_explicit_and_custom_is_clean() {
    let mut p = profile("https://custom.example/v1");
    assert_eq!(p.body(&request("a"))["enable_thinking"], false);
    p.provider = Provider::OpenaiCompatible;
    assert!(p.body(&request("a")).get("enable_thinking").is_none());
    p.stream = None;
    assert!(!p.streaming());
    p.thinking = Thinking::Off;
    assert!(p.validate().is_err());
    p.provider = Provider::Qwen;
    assert!(p.validate().is_ok());
    p.thinking = Thinking::On;
    assert_eq!(p.body(&request("a"))["enable_thinking"], true);
}

#[test]
fn submission_snapshot_is_validated_and_publicly_roundtrips_without_a_key() {
    let p = profile("https://example.org/v1");
    let mut input:crate::models::request::CreateJobInput=serde_json::from_value(json!({"translation":{"model":p.model,"base_url":p.base_url,"credential_ref":p.credential_ref,"workers":p.concurrency,"execution_connection":p}})).unwrap();
    crate::services::job_validation::validate_translation_credentials(&input).unwrap();
    let snapshot =
        crate::models::domain::JobSnapshot::new("roundtrip".into(), input.clone(), vec![]);
    let public = serde_json::to_value(retain_core::models::public_request_payload(
        &snapshot.request_payload,
    ))
    .unwrap();
    assert_eq!(
        public["translation"]["execution_connection"]["thinking"],
        "auto"
    );
    assert!(public["translation"]["execution_connection"]
        .get("api_key")
        .is_none());
    input.translation.workers = 99;
    assert!(crate::services::job_validation::validate_translation_credentials(&input).is_err());
    input.translation.workers = 2;
    input.translation.api_key = "inline-secret".into();
    assert!(crate::services::job_validation::validate_translation_credentials(&input).is_err());
}

#[test]
fn recovery_projection_preserves_receipts_and_blocks_legacy_recovery() {
    use crate::services::jobs::translation_request_recovery::{
        load_translation_request_recovery, load_translation_request_recovery_with_db,
    };
    let f = Fixture::new();
    let e = &f.executor;
    let p = profile("https://example.org/v1");
    let mut job = e.db.get_job("j").unwrap();
    job.request_payload.translation.execution_connection = Some(p.clone());
    assert!(e.db.model_recovery_summary("j").unwrap().is_none());
    let missing = load_translation_request_recovery_with_db(&e.db, &job, &f.root).unwrap();
    assert_eq!(missing.status, "blocked");
    assert_eq!(missing.supported_retry_policies, vec!["block"]);
    e.register_job("j", &p, 60).unwrap();
    for id in ["done", "unknown", "queued"] {
        e.db.reserve_model_operation("j", id, id, id, "primary")
            .unwrap();
    }
    assert!(e.db.claim_model_operation("j", "done").unwrap());
    e.db.finish_model_operation(
        "j",
        "done",
        "succeeded",
        Some(&json!({"content":"private receipt"})),
        None,
    )
    .unwrap();
    assert!(e.db.claim_model_operation("j", "unknown").unwrap());
    e.db.close_model_worker_session("j").unwrap();
    let summary = e.db.model_recovery_summary("j").unwrap().unwrap();
    assert_eq!(
        (summary.succeeded, summary.ambiguous, summary.cancelled),
        (1, 1, 1)
    );
    assert!(!serde_json::to_string(&summary)
        .unwrap()
        .contains("private receipt"));
    let view = load_translation_request_recovery_with_db(&e.db, &job, &f.root).unwrap();
    assert_eq!(view.status, "ambiguous");
    assert_eq!(view.active_ambiguous_request_keys, 1);
    assert!(view.requires_confirmation);
    assert_eq!(view.supported_retry_policies, vec!["block"]);
    assert!(
        load_translation_request_recovery(&job, &f.root)
            .unwrap()
            .requires_confirmation
    );
    // Rotating a capability is not an acknowledgement or an unpause.
    e.register_job("j", &p, 60).unwrap();
    assert!(matches!(
        e.db.reserve_model_operation("j", "new", "new", "new", "primary")
            .unwrap(),
        ModelReservation::Paused
    ));
    assert_eq!(
        e.db.get_model_operation("j", "done")
            .unwrap()
            .unwrap()
            .status,
        "succeeded"
    );
}

#[test]
fn expired_queued_operation_gets_a_terminal_no_dispatch_receipt() {
    let f = Fixture::new();
    let e = &f.executor;
    let p = profile("https://example.org/v1");
    e.register_job("j", &p, 60).unwrap();
    e.db.reserve_model_operation("j", "queued", "unit", "hash", "primary")
        .unwrap();
    e.db.create_model_session("j", "expired", 0, &serde_json::to_value(&p).unwrap())
        .unwrap();
    assert!(!e.db.claim_model_operation("j", "queued").unwrap());
    let operation = e.db.get_model_operation("j", "queued").unwrap().unwrap();
    assert_eq!(operation.status, "cancelled");
    assert_eq!(operation.error_code.as_deref(), Some("dispatch_fenced"));
    assert!(!e.db.claim_model_operation("j", "queued").unwrap());
}

#[tokio::test]
async fn real_python_worker_bridge_uses_only_the_local_capability() {
    let (upstream, upstream_task) = server(Router::new().route(
        "/v1/chat/completions",
        post(|| async { Json(successful()) }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let mut state = crate::api_tests::jobs_common::test_state("python-model-bridge");
    state.model_executor = Some(e.clone());
    let p = profile(&upstream);
    let input:crate::models::request::CreateJobInput=serde_json::from_value(json!({"workflow":"translate","translation":{"model":p.model,"base_url":p.base_url,"credential_ref":p.credential_ref,"workers":p.concurrency,"execution_connection":p}})).unwrap();
    state
        .db
        .save_job(&crate::models::domain::JobSnapshot::new(
            "j".into(),
            input,
            vec![],
        ))
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let api_url = format!("http://{}", listener.local_addr().unwrap());
    let app = crate::app::build_app(state);
    let api_task = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    let capability = e.register_job("j", &p, 60).unwrap();
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap();
    let script = r#"
from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope
from retainpdf_pipeline.translate.llm.providers.deepseek.client import request_chat_content, get_api_key
assert get_api_key(required=True) == ''
with unit_scope('domain', ['document-preview']):
    text = request_chat_content([{'role':'user','content':'test source'}], timeout=1, max_attempts=99)
assert text == 'translated', text
print('bridge-ok')
"#;
    let python_relative = if cfg!(windows) {
        ".venv/Scripts/python.exe"
    } else {
        ".venv/bin/python"
    };
    let python = [
        root.join("backend").join(python_relative),
        root.join(python_relative),
    ]
    .into_iter()
    .find(|path| path.is_file())
    .expect("a project Python environment is required for the worker bridge test");
    let output = tokio::time::timeout(
        Duration::from_secs(20),
        tokio::process::Command::new(python)
            .arg("-c")
            .arg(script)
            .env("PYTHONPATH", root.join("backend/pipeline"))
            .env("RETAIN_TRANSLATION_TRANSPORT", "rust")
            .env("RETAIN_MODEL_EXECUTOR_URL", api_url)
            .env("RETAIN_MODEL_JOB_ID", "j")
            .env("RETAIN_MODEL_CAPABILITY", capability)
            .env_remove("RETAIN_TRANSLATION_API_KEY")
            .env_remove("DEEPSEEK_API_KEY")
            .env_remove("OPENAI_API_KEY")
            .kill_on_drop(true)
            .output(),
    )
    .await
    .unwrap()
    .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "bridge-ok");
    api_task.abort();
    upstream_task.abort();
}

#[tokio::test]
async fn rejects_unsafe_endpoint_shapes_and_private_dns_without_optin() {
    for url in [
        "file:///tmp/secret",
        "https://user:secret@example.com/v1",
        "https://example.com/v1?key=secret",
        "https://example.com/#secret",
    ] {
        assert!(profile(url).validate().is_err());
    }
    let mut p = profile("http://localhost:80/v1");
    p.allow_private_endpoint = false;
    assert!(p.addresses(&p.validate().unwrap()).await.is_err());
}

#[tokio::test]
async fn idempotency_authentication_and_content_conflict() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move |headers: HeaderMap, Json(body): Json<Value>| {
            let seen = seen.clone();
            async move {
                assert_eq!(
                    headers["authorization"],
                    "Bearer test-secret-not-a-real-key"
                );
                assert_eq!(body["enable_thinking"], false);
                seen.fetch_add(1, Ordering::SeqCst);
                Json(successful())
            }
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("job-a", &profile(&url), 60).unwrap();
    assert!(e.submit("job-b", &token, request("op")).await.is_err());
    assert!(e.submit("job-a", "bad", request("op")).await.is_err());
    let (a, b) = tokio::join!(
        e.submit("job-a", &token, request("op")),
        e.submit("job-a", &token, request("op"))
    );
    assert!(a.is_ok() && b.is_ok());
    let mut changed = request("op");
    changed.temperature = 1.0;
    assert!(e.submit("job-a", &token, changed).await.is_err());
    let op = terminal(e, "job-a", &token, "op").await;
    assert_eq!(op.status, "succeeded");
    assert_eq!(op.result.as_ref().unwrap()["reasoning_tokens"], 3);
    assert!(op.result.as_ref().unwrap()["connect_ms"].is_null());
    e.submit("job-a", &token, request("op")).await.unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    let snapshot =
        e.db.authorize_model_session("job-a", &fingerprint(token.as_bytes()), 0)
            .unwrap()
            .unwrap();
    assert!(!snapshot.profile.to_string().contains("test-secret"));
    task.abort();
}

#[tokio::test]
async fn successful_primary_allows_exactly_one_protocol_repair() {
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(|| async { Json(successful()) }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    let mut repair = request("fix");
    repair.unit_id = "primary".into();
    repair.purpose = "repair".into();
    assert!(e.submit("j", &token, repair.clone()).await.is_err());
    e.submit("j", &token, request("primary")).await.unwrap();
    terminal(e, "j", &token, "primary").await;
    e.submit("j", &token, repair.clone()).await.unwrap();
    terminal(e, "j", &token, "fix").await;
    repair.operation_id = "fix-again".into();
    assert!(e.submit("j", &token, repair).await.is_err());
    task.abort();
}

#[tokio::test]
async fn timeout_is_not_retried_and_pauses_new_units() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let seen = seen.clone();
            async move {
                seen.fetch_add(1, Ordering::SeqCst);
                tokio::time::sleep(Duration::from_secs(2)).await;
                Json(successful())
            }
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "ambiguous");
    assert_eq!(op.error_code.as_deref(), Some("read_idle_timeout"));
    assert!(e.submit("j", &token, request("other")).await.is_err());
    assert_eq!(count.load(Ordering::SeqCst), 1);
    task.abort();
}

#[tokio::test]
async fn only_429_retries_once() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let seen = seen.clone();
            async move {
                if seen.fetch_add(1, Ordering::SeqCst) == 0 {
                    (
                        StatusCode::TOO_MANY_REQUESTS,
                        [("retry-after", "0")],
                        "do not log me",
                    )
                        .into_response()
                } else {
                    Json(successful()).into_response()
                }
            }
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "succeeded");
    assert_eq!(count.load(Ordering::SeqCst), 2);
    assert_eq!(op.result.unwrap()["retry_reasons"], json!(["explicit_429"]));
    task.abort();
}

#[tokio::test]
async fn provider_rejection_is_masked_and_not_retried() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let seen = seen.clone();
            async move {
                seen.fetch_add(1, Ordering::SeqCst);
                (
                    StatusCode::BAD_REQUEST,
                    "Arrearage echoed-secret sensitive source text",
                )
            }
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "failed");
    assert!(!serde_json::to_string(&op)
        .unwrap()
        .contains("echoed-secret"));
    assert_eq!(count.load(Ordering::SeqCst), 1);
    assert!(e.submit("j", &token, request("other")).await.is_err());
    task.abort();
}

#[tokio::test]
async fn streaming_aggregates_content_and_usage_but_not_reasoning() {
    let events="data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"private chain of thought\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"译文\"},\"finish_reason\":\"stop\"}]}\n\ndata: {\"choices\":[],\"usage\":{\"prompt_tokens\":4,\"completion_tokens\":5,\"completion_tokens_details\":{\"reasoning_tokens\":3}}}\n\ndata: [DONE]\n\n";
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || async move { ([("content-type", "text/event-stream")], events) }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let mut p = profile(&url);
    p.stream = Some(true);
    let token = e.register_job("j", &p, 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "succeeded");
    let result = op.result.unwrap();
    assert_eq!(result["content"], "译文");
    assert_eq!(result["reasoning_tokens"], 3);
    assert!(!result.to_string().contains("private chain"));
    task.abort();
}

#[tokio::test]
async fn empty_and_truncated_responses_are_not_success() {
    for (content, finish) in [("", "stop"), ("partial", "length")] {
        let (url, task) = server(Router::new().route(
            "/v1/chat/completions",
            post(move || async move {
                Json(json!({"choices":[{"message":{"content":content},"finish_reason":finish}]}))
            }),
        ))
        .await;
        let f = Fixture::new();
        let e = &f.executor;
        let token = e.register_job("j", &profile(&url), 60).unwrap();
        e.submit("j", &token, request("op")).await.unwrap();
        let op = terminal(e, "j", &token, "op").await;
        assert_eq!(op.status, "ambiguous");
        assert!(op.result.unwrap()["content"].is_null());
        task.abort();
    }
}

#[test]
fn restart_recovery_and_immutable_snapshot() {
    let f = Fixture::new();
    let e = &f.executor;
    let p = profile("http://127.0.0.1/v1");
    let token = e.register_job("j", &p, 60).unwrap();
    e.db.reserve_model_operation("j", "op", "unit", "hash", "primary")
        .unwrap();
    assert!(e.db.claim_model_operation("j", "op").unwrap());
    assert_eq!(e.db.recover_model_operations().unwrap(), 1);
    assert_eq!(e.db.recover_model_operations().unwrap(), 0);
    assert_eq!(
        e.status("j", &token, "op").unwrap().unwrap().status,
        "ambiguous"
    );
    let mut changed = p.clone();
    changed.model = "different".into();
    assert!(matches!(
        e.register_job("j", &changed, 60),
        Err(ModelExecutorError::Conflict(_))
    ));
    let new_token = e.register_job("j", &p, 60).unwrap();
    assert!(e.status("j", &token, "op").is_err());
    assert!(e.status("j", &new_token, "op").is_ok());
    assert!(e
        .db
        .authorize_model_session("j", &fingerprint(new_token.as_bytes()), i64::MAX)
        .unwrap()
        .is_none());
}

#[test]
fn session_storage_failures_are_internal_not_authentication_or_conflict() {
    let f = Fixture::new();
    let p = profile("http://127.0.0.1/v1");
    let token = f.executor.register_job("j", &p, 60).unwrap();
    let conn = rusqlite::Connection::open(f.root.join("jobs.db")).unwrap();
    conn.execute("DROP TABLE model_sessions", []).unwrap();
    assert!(matches!(
        f.executor.register_job("j", &p, 60),
        Err(ModelExecutorError::Internal(_))
    ));
    assert!(matches!(
        f.executor.authorize("j", &token),
        Err(ModelExecutorError::Internal(_))
    ));
    assert!(matches!(
        f.executor.status("j", &token, "op"),
        Err(ModelExecutorError::Internal(_))
    ));
    assert!(matches!(
        f.executor.cancel("j", &token, "op"),
        Err(ModelExecutorError::Internal(_))
    ));
}

#[test]
fn stored_profile_corruption_is_internal_and_does_not_leak_contents() {
    for stored in [
        "not-json-secret-sentinel",
        r#"{"unexpected":"secret-sentinel"}"#,
    ] {
        let f = Fixture::new();
        let token = f
            .executor
            .register_job("j", &profile("http://127.0.0.1/v1"), 60)
            .unwrap();
        rusqlite::Connection::open(f.root.join("jobs.db"))
            .unwrap()
            .execute(
                "UPDATE model_sessions SET profile_json=?1 WHERE job_id='j'",
                [stored],
            )
            .unwrap();
        let error = f.executor.authorize("j", &token).unwrap_err();
        assert!(matches!(error, ModelExecutorError::Internal(_)));
        assert!(!error.to_string().contains("secret-sentinel"));
        assert!(!format!("{error:?}").contains(&token));
    }
}

#[tokio::test]
async fn operation_storage_failures_remain_internal_after_valid_authorization() {
    let f = Fixture::new();
    let token = f
        .executor
        .register_job("j", &profile("http://127.0.0.1/v1"), 60)
        .unwrap();
    rusqlite::Connection::open(f.root.join("jobs.db"))
        .unwrap()
        .execute("DROP TABLE model_operations", [])
        .unwrap();
    assert!(f.executor.authorize("j", &token).is_ok());
    assert!(matches!(
        f.executor.status("j", &token, "op"),
        Err(ModelExecutorError::Internal(_))
    ));
    assert!(matches!(
        f.executor.cancel("j", &token, "op"),
        Err(ModelExecutorError::Internal(_))
    ));
    assert!(matches!(
        f.executor.submit("j", &token, request("op")).await,
        Err(ModelExecutorError::Internal(_))
    ));
}

#[tokio::test]
async fn bad_requests_and_invalid_capabilities_have_distinct_error_types() {
    let f = Fixture::new();
    let p = profile("http://127.0.0.1/v1");
    assert!(matches!(
        f.executor.register_job("j", &p, 0),
        Err(ModelExecutorError::BadRequest(_))
    ));
    let token = f.executor.register_job("j", &p, 60).unwrap();
    assert!(matches!(
        f.executor.authorize("j", "invalid"),
        Err(ModelExecutorError::Unauthorized)
    ));
    assert!(matches!(
        f.executor.authorize("job-a", &token),
        Err(ModelExecutorError::Unauthorized)
    ));
    assert!(matches!(
        f.executor.authorize("j", &"0".repeat(64)),
        Err(ModelExecutorError::Unauthorized)
    ));
    let mut invalid = request("op");
    invalid.operation_id.clear();
    assert!(matches!(
        f.executor.submit("j", &token, invalid).await,
        Err(ModelExecutorError::BadRequest(_))
    ));
}

#[tokio::test]
async fn redirects_never_forward_credentials() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let app = Router::new()
        .route(
            "/v1/chat/completions",
            post(|| async { (StatusCode::TEMPORARY_REDIRECT, [("location", "/stolen")]) }),
        )
        .route(
            "/stolen",
            post(move || {
                let seen = seen.clone();
                async move {
                    seen.fetch_add(1, Ordering::SeqCst);
                    Response::new(axum::body::Body::empty())
                }
            }),
        );
    let (url, task) = server(app).await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.error_code.as_deref(), Some("redirect_rejected"));
    assert_eq!(count.load(Ordering::SeqCst), 0);
    task.abort();
}

#[test]
fn cancellation_fences_dispatch_and_does_not_overwrite_receipts() {
    let f = Fixture::new();
    let e = &f.executor;
    let token = e
        .register_job("j", &profile("http://127.0.0.1/v1"), 60)
        .unwrap();
    e.db.reserve_model_operation("j", "queued", "queued", "h", "primary")
        .unwrap();
    assert!(e.cancel("j", &token, "queued").unwrap());
    assert!(!e.db.claim_model_operation("j", "queued").unwrap());
    e.db.reserve_model_operation("j", "running", "running", "h", "primary")
        .unwrap();
    assert!(e.db.claim_model_operation("j", "running").unwrap());
    assert!(e.cancel("j", &token, "running").unwrap());
    assert_eq!(
        e.status("j", &token, "running").unwrap().unwrap().status,
        "ambiguous"
    );
    assert!(!e
        .db
        .finish_model_operation("j", "running", "succeeded", None, None)
        .unwrap());
}

#[tokio::test]
async fn connection_limit_is_shared_across_revisions_and_can_be_lowered() {
    let f = Fixture::new();
    let mut a = profile("http://127.0.0.1:9/v1");
    a.concurrency = 2;
    let mut b = a.clone();
    b.revision = 2;
    b.model = "another-model".into();
    b.concurrency = 1;
    let first = f.executor.pool(&a).await.unwrap();
    let second = f.executor.pool(&b).await.unwrap();
    assert!(Arc::ptr_eq(&first.slots, &second.slots));
    let permit = first.slots.acquire(2).await;
    assert!(
        tokio::time::timeout(Duration::from_millis(30), second.slots.acquire(1))
            .await
            .is_err()
    );
    drop(permit);
    let small = second.slots.acquire(1).await;
    assert!(
        tokio::time::timeout(Duration::from_millis(30), first.slots.acquire(2))
            .await
            .is_err()
    );
    drop(small);
    assert!(
        tokio::time::timeout(Duration::from_millis(30), first.slots.acquire(2))
            .await
            .is_ok()
    );
}

#[tokio::test]
async fn http_routes_separate_launcher_and_worker_authority() {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;
    let f = Fixture::new();
    let mut state = crate::api_tests::jobs_common::test_state("model-route-authority");
    state.model_executor = Some(f.executor.clone());
    let profile = profile("http://127.0.0.1:9/v1");
    let input:crate::models::request::CreateJobInput=serde_json::from_value(json!({"workflow":"translate","translation":{"execution_connection":profile,"model":profile.model,"base_url":profile.base_url,"credential_ref":profile.credential_ref,"workers":profile.concurrency}})).unwrap();
    state
        .db
        .save_job(&crate::models::domain::JobSnapshot::new(
            "j".into(),
            input,
            vec![],
        ))
        .unwrap();
    let app = crate::app::build_app(state);
    let capability_uri = "/api/v1/internal/model/jobs/j/capability";
    let body = serde_json::to_vec(&profile).unwrap();
    let unauthorized = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(capability_uri)
                .header("content-type", "application/json")
                .body(Body::from(body.clone()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);
    let authorized = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(capability_uri)
                .header("content-type", "application/json")
                .header("x-api-key", "test-key")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(authorized.status(), StatusCode::OK);
    let capability = crate::api_tests::jobs_common::read_json(authorized).await["capability"]
        .as_str()
        .unwrap()
        .to_owned();
    let uri = "/api/v1/internal/model/jobs/j/requests/op";
    let app_key_not_worker = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("x-api-key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(app_key_not_worker.status(), StatusCode::UNAUTHORIZED);
    let own = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("authorization", format!("Bearer {capability}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(own.status(), StatusCode::NOT_FOUND);
    let other = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/internal/model/jobs/other/requests/op")
                .header("authorization", format!("Bearer {capability}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(other.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn incomplete_stream_does_not_publish_partial_content() {
    let events="data: {\"choices\":[{\"delta\":{\"content\":\"partial\"},\"finish_reason\":\"stop\"}]}\n\n";
    let (url, task) =
        server(Router::new().route("/v1/chat/completions", post(move || async move { events })))
            .await;
    let f = Fixture::new();
    let e = &f.executor;
    let mut p = profile(&url);
    p.stream = Some(true);
    let token = e.register_job("j", &p, 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.error_code.as_deref(), Some("stream_missing_done"));
    assert!(op.result.unwrap()["content"].is_null());
    task.abort();
}
