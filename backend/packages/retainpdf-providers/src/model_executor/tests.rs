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
            let input: retainpdf_core::models::request::CreateJobInput =
                serde_json::from_value(json!({})).unwrap();
            db.save_job(&retainpdf_core::models::domain::JobSnapshot::new(
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
        // 留足余量：这些测试并行跑在调试构建里，本机回环也可能慢上几百毫秒，超时会被记成 ambiguous。
        // 只有 timeout_is_not_retried_and_pauses_new_units 要等超时，它的假服务睡 2 秒，比 idle_ms 长。
        deadlines: Deadlines {
            queue_ms: 2_000,
            connect_ms: 1_000,
            idle_ms: 1_000,
            total_ms: 3_000,
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
    let result = op.result.unwrap();
    assert_eq!(result["retry_reasons"], json!(["explicit_429"]));
    assert!(result.get("upstream_status").is_none(), "重试成功了不留上游错");
    assert!(result.get("upstream_provider").is_none());
    task.abort();
}

#[tokio::test]
async fn quota_429_is_not_retried_and_pauses_the_job() {
    // 429 不全是限流：业务码说额度用完（这里是 OpenAI 的 insufficient_quota）就第一次停下，不按 retry-after 再发
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let seen = seen.clone();
            async move {
                seen.fetch_add(1, Ordering::SeqCst);
                (
                    StatusCode::TOO_MANY_REQUESTS,
                    [("retry-after", "0")],
                    r#"{"error":{"message":"You exceeded your current quota echoed-secret","type":"insufficient_quota","code":"insufficient_quota"}}"#,
                )
                    .into_response()
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
    assert_eq!(op.error_code.as_deref(), Some("quota_exhausted"));
    assert_eq!(count.load(Ordering::SeqCst), 1, "额度用完不重试");
    let result = op.result.clone().unwrap();
    assert_eq!(result["upstream_status"], json!(429));
    assert_eq!(result["upstream_code"], json!("insufficient_quota"));
    assert_eq!(result["upstream_provider"], json!("custom"), "本地地址认不出服务商");
    assert!(!serde_json::to_string(&op).unwrap().contains("echoed-secret"));
    assert!(e.submit("j", &token, request("other")).await.is_err(), "整份停下：后面的请求不再收");
    task.abort();
}

/// 2026-11-23：模型不可用（404）整份停下；内容审核没过只这一个请求失败，任务不暂停，后面的请求照收。
#[tokio::test]
async fn model_404_pauses_but_content_rejection_does_not() {
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(|| async {
            (
                StatusCode::NOT_FOUND,
                r#"{"error":{"message":"The model `x` does not exist echoed-secret","code":"model_not_found"}}"#,
            )
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    e.submit("j", &token, request("op")).await.unwrap();
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "failed");
    assert_eq!(op.error_code.as_deref(), Some("model_unavailable"));
    let result = op.result.clone().unwrap();
    assert_eq!(result["upstream_status"], json!(404));
    assert_eq!(result["upstream_code"], json!("model_not_found"));
    assert!(!serde_json::to_string(&op).unwrap().contains("echoed-secret"));
    assert!(e.submit("j", &token, request("other")).await.is_err(), "整份停下：后面的请求不再收");
    task.abort();

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
                    r#"{"error":{"message":"Input data may contain inappropriate content.","code":"DataInspectionFailed"}}"#,
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
    assert_eq!(op.error_code.as_deref(), Some("content_rejected"));
    assert_eq!(count.load(Ordering::SeqCst), 1, "内容审核没过不重试");
    assert_eq!(op.result.clone().unwrap()["upstream_code"], json!("DataInspectionFailed"));
    e.submit("j", &token, request("other")).await.expect("内容审核只是这一块：任务不暂停");
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
    // 认不出业务码的拒绝也带上状态码和服务商（任务失败的 upstream 用），不带码
    let result = op.result.clone().unwrap();
    assert_eq!(result["upstream_status"], json!(400));
    assert_eq!(result["upstream_provider"], json!("custom"));
    assert!(result.get("upstream_code").is_none());
    assert!(e.submit("j", &token, request("other")).await.is_err());
    task.abort();
}

#[test]
fn vendor_for_url_uses_catalogue_ids() {
    let vendor = |u: &str| super::transport::vendor_for_url(&url::Url::parse(u).unwrap());
    assert_eq!(vendor("https://api.openai.com/v1/chat/completions"), "openai");
    assert_eq!(vendor("https://open.bigmodel.cn/api/paas/v4/chat/completions"), "zhipu");
    assert_eq!(vendor("https://dashscope.aliyuncs.com/compatible-mode/v1"), "qwen");
    assert_eq!(vendor("https://relay.example.com/v1"), "custom");
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
    // 空回答、结束原因不认识：照旧 ambiguous。截断、被内容过滤（上游明确说没写完）：failed + output_incomplete，
    // 回执写 finish_reason，半截内容不交回（2026-11-23，以前截断也记 ambiguous）
    for (content, finish, status, code) in [
        ("", "stop", "ambiguous", "empty_response"),
        ("partial", "tool_calls", "ambiguous", "response_not_complete"),
        ("partial", "length", "failed", "output_incomplete"),
        ("partial", "content_filter", "failed", "output_incomplete"),
        ("partial", "sensitive", "failed", "output_incomplete"),
    ] {
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
        assert_eq!(op.status, status, "{finish}");
        assert_eq!(op.error_code.as_deref(), Some(code), "{finish}");
        let result = op.result.unwrap();
        assert!(result["content"].is_null());
        assert_eq!(result["finish_reason"], json!(finish));
        task.abort();
    }
}

#[tokio::test]
async fn truncated_stream_is_output_incomplete_and_keeps_the_job_open() {
    let events = "data: {\"choices\":[{\"delta\":{\"content\":\"半截\"},\"finish_reason\":\"length\"}]}\n\ndata: [DONE]\n\n";
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
    assert_eq!(op.status, "failed");
    assert_eq!(op.error_code.as_deref(), Some("output_incomplete"));
    let result = op.result.unwrap();
    assert!(result["content"].is_null());
    assert_eq!(result["finish_reason"], json!("length"));
    // 不是 ambiguous：没有暂停整份，别的单元照常能提交
    assert!(e.submit("j", &token, request("other")).await.is_ok());
    task.abort();
}

#[tokio::test]
async fn request_too_long_is_named_and_not_retried() {
    for (status, body, code) in [
        (
            StatusCode::BAD_REQUEST,
            r#"{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 210000 tokens > 200000 maximum"}}"#,
            "prompt_too_long",
        ),
        (
            StatusCode::PAYLOAD_TOO_LARGE,
            r#"{"type":"error","error":{"type":"request_too_large","message":"Request exceeds the maximum size"}}"#,
            "request_too_large",
        ),
        (
            StatusCode::BAD_REQUEST,
            r#"{"error":{"code":"1261","message":"Prompt 超长"}}"#,
            "1261",
        ),
    ] {
        let count = Arc::new(AtomicUsize::new(0));
        let seen = count.clone();
        let (url, task) = server(Router::new().route(
            "/v1/chat/completions",
            post(move || {
                let seen = seen.clone();
                async move {
                    seen.fetch_add(1, Ordering::SeqCst);
                    (status, body).into_response()
                }
            }),
        ))
        .await;
        let f = Fixture::new();
        let e = &f.executor;
        let token = e.register_job("j", &profile(&url), 60).unwrap();
        e.submit("j", &token, request("op")).await.unwrap();
        let op = terminal(e, "j", &token, "op").await;
        assert_eq!(op.status, "failed", "{code}");
        assert_eq!(op.error_code.as_deref(), Some("request_too_long"), "{code}");
        assert_eq!(count.load(Ordering::SeqCst), 1, "太长不重试");
        let result = op.result.unwrap();
        assert_eq!(result["upstream_status"], json!(status.as_u16()));
        assert_eq!(result["upstream_code"], json!(code));
        assert!(!result.to_string().contains("210000"), "响应体原文不进回执");
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
        Err(ModelExecutorError::Conflict {
            reason: "model_connection_changed",
            ..
        })
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

#[tokio::test]
async fn rate_limit_wait_is_visible_in_status_until_the_retry() {
    let count = Arc::new(AtomicUsize::new(0));
    let seen = count.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move || {
            let seen = seen.clone();
            async move {
                if seen.fetch_add(1, Ordering::SeqCst) == 0 {
                    (StatusCode::TOO_MANY_REQUESTS, [("retry-after", "1")], "slow down").into_response()
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
    let wait = tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            let op = e.status("j", &token, "op").unwrap().unwrap();
            if let Some(wait) = op.upstream_wait {
                assert_eq!(op.status, "running");
                return wait;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("wait becomes visible while the executor sleeps");
    assert_eq!(wait["provider"], "custom");
    assert_eq!(wait["http_status"], 429);
    assert_eq!(wait["reason"], "rate_limited");
    assert_eq!(wait["retry_after_s"], 1.0);
    assert_eq!(wait["wait_source"], "retry_after");
    assert_eq!(wait["attempt"], 1);
    assert_eq!(wait["max_attempts"], 2);
    assert!(wait["until"].as_str().unwrap() > wait["started_at"].as_str().unwrap());
    let op = terminal(e, "j", &token, "op").await;
    assert_eq!(op.status, "succeeded");
    assert!(op.upstream_wait.is_none());
    assert!(serde_json::to_value(&op).unwrap().get("upstream_wait").is_none());
    assert!(e.waits.lock().unwrap().is_empty());
    task.abort();
}

#[test]
fn upstream_wait_provider_follows_the_catalogue_hosts() {
    let vendor = |raw: &str| transport::vendor_for_url(&url::Url::parse(raw).unwrap());
    assert_eq!(vendor("https://api.deepseek.com/v1"), "deepseek");
    assert_eq!(vendor("https://dashscope.aliyuncs.com/compatible-mode/v1"), "qwen");
    assert_eq!(vendor("https://open.bigmodel.cn/api/paas/v4"), "zhipu");
    assert_eq!(vendor("https://opencode.ai/inference/go/v1"), "opencode");
    assert_eq!(vendor("https://opencode.ai.example/v1"), "custom");
    assert_eq!(vendor("http://127.0.0.1:9/v1"), "custom");
}

fn png_data_url(bytes: usize) -> String {
    use base64::Engine;
    let data = base64::engine::general_purpose::STANDARD.encode(vec![7u8; bytes]);
    format!("data:image/png;base64,{data}")
}

fn image_message(role: &str, url: String) -> Message {
    Message {
        role: role.into(),
        content: MessageContent::Parts(vec![
            ContentPart::Text {
                text: "看这张表".into(),
            },
            ContentPart::ImageUrl {
                image_url: ImageUrl { url, detail: None },
            },
        ]),
    }
}

#[test]
fn text_messages_serialize_exactly_as_before() {
    // 纯文字的请求指纹不能变：已经落库的操作要照旧认出是同一次请求
    let encoded = serde_json::to_value(request("op").messages).unwrap();
    assert_eq!(
        encoded,
        json!([{"role":"user","content":"sensitive source text"}])
    );
    let parsed: Message = serde_json::from_value(json!({"role":"user","content":"x"})).unwrap();
    assert!(matches!(parsed.content, MessageContent::Text(ref t) if t == "x"));
}

#[test]
fn image_parts_are_validated_and_sent_in_chat_shape() {
    let mut ok = request("op");
    ok.messages = vec![
        Message {
            role: "system".into(),
            content: "rules".into(),
        },
        image_message("user", png_data_url(64)),
    ];
    ok.validate().unwrap();
    let body = profile("http://127.0.0.1/v1").body(&ok);
    assert_eq!(body["messages"][1]["content"][0], json!({"type":"text","text":"看这张表"}));
    assert_eq!(body["messages"][1]["content"][1]["type"], "image_url");
    assert!(body["messages"][1]["content"][1]["image_url"]["url"]
        .as_str()
        .unwrap()
        .starts_with("data:image/png;base64,"));
    assert!(body["messages"][1]["content"][1]["image_url"].get("detail").is_none());

    let parsed: ModelRequest = serde_json::from_value(json!({
        "operation_id":"op","unit_id":"op","purpose":"primary","temperature":0.2,
        "messages":[{"role":"user","content":[{"type":"text","text":"a"},{"type":"image_url","image_url":{"url":png_data_url(8),"detail":"high"}}]}]
    }))
    .unwrap();
    parsed.validate().unwrap();

    let rejected = |messages: Vec<Message>| {
        let mut r = request("op");
        r.messages = messages;
        r.validate().is_err()
    };
    // 外部地址、不收的类型、坏 base64、空图、超大图
    assert!(rejected(vec![image_message("user", "https://example.com/a.png".into())]));
    assert!(rejected(vec![image_message("user", "data:image/svg+xml;base64,AAAA".into())]));
    assert!(rejected(vec![image_message("user", "data:image/png;base64,***".into())]));
    assert!(rejected(vec![image_message("user", "data:image/png;base64,".into())]));
    assert!(rejected(vec![image_message("user", png_data_url(MAX_IMAGE_BYTES + 1))]));
    // 图只能在用户消息里；片段列表不能空；一次最多 4 张
    assert!(rejected(vec![image_message("system", png_data_url(8))]));
    assert!(rejected(vec![image_message("assistant", png_data_url(8))]));
    assert!(rejected(vec![Message {
        role: "user".into(),
        content: MessageContent::Parts(vec![]),
    }]));
    assert!(rejected(
        (0..=MAX_REQUEST_IMAGES).map(|_| image_message("user", png_data_url(8))).collect()
    ));
    // 不认识的片段类型、多出来的字段
    for bad in [
        json!({"role":"user","content":[{"type":"input_audio","input_audio":{}}]}),
        json!({"role":"user","content":[{"type":"text","text":"a","cache_control":{}}]}),
        json!({"role":"user","content":[{"type":"image_url","image_url":{"url":png_data_url(8),"extra":1}}]}),
    ] {
        assert!(serde_json::from_value::<Message>(bad).is_err());
    }
    let mut bad_detail = image_message("user", png_data_url(8));
    if let MessageContent::Parts(parts) = &mut bad_detail.content {
        parts[1] = ContentPart::ImageUrl {
            image_url: ImageUrl {
                url: png_data_url(8),
                detail: Some("ultra".into()),
            },
        };
    }
    assert!(rejected(vec![bad_detail]));
}

#[tokio::test]
async fn image_request_reaches_the_provider_unchanged() {
    let seen = Arc::new(std::sync::Mutex::new(None::<Value>));
    let captured = seen.clone();
    let (url, task) = server(Router::new().route(
        "/v1/chat/completions",
        post(move |Json(body): Json<Value>| {
            let captured = captured.clone();
            async move {
                *captured.lock().unwrap() = Some(body);
                Json(successful())
            }
        }),
    ))
    .await;
    let f = Fixture::new();
    let e = &f.executor;
    let token = e.register_job("j", &profile(&url), 60).unwrap();
    let mut with_image = request("img");
    let image = png_data_url(32);
    with_image.messages = vec![image_message("user", image.clone())];
    e.submit("j", &token, with_image).await.unwrap();
    let op = terminal(e, "j", &token, "img").await;
    assert_eq!(op.status, "succeeded");
    let body = seen.lock().unwrap().clone().unwrap();
    assert_eq!(body["messages"][0]["content"][1]["image_url"]["url"], image);
    task.abort();
}
