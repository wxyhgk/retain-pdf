use super::deepseek::is_model_rejection;
use super::ocr::{classify_paddle_probe_error, classify_probe_error};
use super::url_policy::validate_provider_base_url;
use retainpdf_data::ocr_provider::paddle::PaddleProviderError;

/// 测试的假服务商都在 127.0.0.1 上：全放开私网，超时按用例给。
fn test_policy(timeout_secs: u64) -> super::policy::ProbePolicy {
    super::policy::ProbePolicy::new(timeout_secs, super::policy::PrivateTargets::AllowAll)
}

#[test]
fn validate_provider_base_url_allows_public_https_host() {
    assert!(validate_provider_base_url("https://api.deepseek.com/v1", false).is_ok());
}

#[test]
fn validate_provider_base_url_rejects_non_http_scheme() {
    let err = validate_provider_base_url("ftp://example.com", false).unwrap_err();
    assert!(err.to_string().contains("scheme"));
}

#[test]
fn validate_provider_base_url_rejects_localhost_hostname() {
    let err = validate_provider_base_url("http://localhost:11434", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_loopback_ip() {
    let err = validate_provider_base_url("http://127.0.0.1:8080", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_link_local_metadata_ip() {
    let err = validate_provider_base_url("http://169.254.169.254/latest", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_private_network_ranges() {
    assert!(validate_provider_base_url("http://10.0.0.5", false).is_err());
    assert!(validate_provider_base_url("http://172.16.0.5", false).is_err());
    assert!(validate_provider_base_url("http://192.168.1.5", false).is_err());
}

#[test]
fn validate_provider_base_url_rejects_ipv6_loopback_and_unique_local() {
    assert!(validate_provider_base_url("http://[::1]", false).is_err());
    assert!(validate_provider_base_url("http://[fc00::1]", false).is_err());
    assert!(validate_provider_base_url("http://[fe80::1]", false).is_err());
}

#[test]
fn validate_provider_base_url_rejects_embedded_credentials() {
    let err = validate_provider_base_url("https://user:pass@example.com", false).unwrap_err();
    assert!(err.to_string().contains("credentials"));
}

#[test]
fn validate_provider_base_url_allow_private_urls_escape_hatch() {
    assert!(validate_provider_base_url("http://127.0.0.1:11434", true).is_ok());
    assert!(validate_provider_base_url("http://localhost:11434", true).is_ok());
}

#[test]
fn classify_probe_error_maps_invalid_token() {
    let view = classify_probe_error(
        r#"MinerU API error code=A0202: invalid token trace_id=trace-1"#.to_string(),
        "https://mineru.net".to_string(),
        "2026-04-06T00:00:00Z".to_string(),
    );
    assert!(!view.ok);
    assert_eq!(view.status, "unauthorized");
    assert_eq!(view.provider_code.as_deref(), Some("A0202"));
}

#[test]
fn classify_probe_error_maps_expired_token() {
    let view = classify_probe_error(
        r#"MinerU API error code=A0211: token expired trace_id=trace-2"#.to_string(),
        "https://mineru.net".to_string(),
        "2026-04-06T00:00:00Z".to_string(),
    );
    assert!(!view.ok);
    assert_eq!(view.status, "expired");
    assert_eq!(view.provider_code.as_deref(), Some("A0211"));
}

#[test]
fn classify_probe_error_maps_network_failure() {
    let view = classify_probe_error(
        "POST https://mineru.net/api/v4/file-urls/batch failed: operation timed out".to_string(),
        "https://mineru.net".to_string(),
        "2026-04-06T00:00:00Z".to_string(),
    );
    assert!(!view.ok);
    assert_eq!(view.status, "network_error");
    assert!(view.retryable);
}

#[test]
fn classify_paddle_probe_error_maps_unauthorized() {
    let err = anyhow::Error::new(PaddleProviderError::http_status(
        "probe",
        reqwest::StatusCode::UNAUTHORIZED,
        r#"{"errorCode":401,"errorMsg":"unauthorized"}"#,
        Some("trace-1"),
        None,
    ));
    let view = classify_paddle_probe_error(
        err,
        "https://paddleocr.aistudio-app.com".to_string(),
        "2026-04-26T00:00:00Z".to_string(),
    );
    assert!(!view.ok);
    assert_eq!(view.status, "unauthorized");
}

#[test]
fn classify_paddle_probe_error_maps_not_found_as_valid() {
    let err = anyhow::Error::new(PaddleProviderError::http_status(
        "probe",
        reqwest::StatusCode::NOT_FOUND,
        r#"{"errorCode":404,"errorMsg":"not found"}"#,
        Some("trace-2"),
        None,
    ));
    let view = classify_paddle_probe_error(
        err,
        "https://paddleocr.aistudio-app.com".to_string(),
        "2026-04-26T00:00:00Z".to_string(),
    );
    assert!(view.ok);
    assert_eq!(view.status, "valid");
}

// --- 翻译接口探针的模型拒绝分类 -------------------------------------------
// 探针改走 /chat/completions 后，4xx 既可能是 Key 问题也可能是模型问题，
// 两者给用户的下一步动作完全不同，分类错了就把人指向错误的输入框。

#[test]
fn is_model_rejection_detects_openai_style_model_not_found() {
    assert!(is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("The model `gpt-nonexistent` does not exist"),
    ));
}

#[test]
fn is_model_rejection_detects_chinese_model_error() {
    assert!(is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("模型不存在或无权限"),
    ));
}

#[test]
fn is_model_rejection_treats_bare_404_as_model_unavailable() {
    // 兼容层缺少 /chat/completions 时正文常常不可解析，等价于该模型不可用。
    assert!(is_model_rejection(reqwest::StatusCode::NOT_FOUND, None));
}

#[test]
fn is_model_rejection_ignores_unrelated_bad_request() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("invalid temperature value"),
    ));
}

#[test]
fn is_model_rejection_ignores_rate_limit_and_server_errors() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        Some("model rate limit exceeded"),
    ));
    assert!(!is_model_rejection(
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        Some("model backend crashed"),
    ));
}

#[test]
fn is_model_rejection_ignores_unauthorized_even_when_body_mentions_model() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::UNAUTHORIZED,
        Some("no access to model"),
    ));
}

/// Anthropic 协议的探针走 `/messages` + x-api-key,不带 Bearer。
#[tokio::test]
async fn anthropic_probe_uses_the_messages_api() {
    use super::deepseek::validate_deepseek_token_view;
    use super::types::DeepSeekTokenValidationRequest;
    use retainpdf_core::config::DeepSeekRuntimeConfig;
    use axum::http::HeaderMap;
    use axum::routing::post;
    use std::sync::{Arc, Mutex};

    let seen: Arc<Mutex<Vec<(Option<String>, Option<String>, Option<String>, serde_json::Value)>>> =
        Arc::default();
    let recorder = seen.clone();
    let router = axum::Router::new().route(
        "/v1/messages",
        post(move |headers: HeaderMap, axum::Json(body): axum::Json<serde_json::Value>| {
            let recorder = recorder.clone();
            async move {
                let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
                recorder.lock().unwrap().push((
                    header("x-api-key"),
                    header("anthropic-version"),
                    header("authorization"),
                    body,
                ));
                axum::Json(serde_json::json!({"content": [{"type": "text", "text": "p"}]}))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    let view = validate_deepseek_token_view(
        DeepSeekTokenValidationRequest {
            api_key: "sk-ant".into(),
            base_url: format!("http://{addr}/v1"),
            model: "claude-sonnet-5".into(),
            api_protocol: "anthropic".into(),
        },
        DeepSeekRuntimeConfig {
            default_base_url: "https://api.deepseek.com/v1".into(),
            balance_url: String::new(),
            probe_timeout_secs: 5,
            allow_private_urls: true,
        },
        test_policy(5),
    )
    .await
    .unwrap();

    assert!(view.ok, "{}", view.summary);
    let seen = seen.lock().unwrap();
    let (key, version, authorization, body) = &seen[0];
    assert_eq!(key.as_deref(), Some("sk-ant"));
    assert_eq!(version.as_deref(), Some("2023-06-01"));
    assert_eq!(authorization, &None);
    assert_eq!(body["model"], "claude-sonnet-5");
    assert_eq!(body["max_tokens"], 1);
}

/// 起一个本地假服务商:`route` 上记下请求头和请求体,回 `status` + `reply`。
async fn fake_provider(
    route: &'static str,
    status: u16,
    reply: serde_json::Value,
) -> (
    std::net::SocketAddr,
    std::sync::Arc<std::sync::Mutex<Vec<(Option<String>, serde_json::Value)>>>,
) {
    use axum::http::{HeaderMap, StatusCode};
    use axum::routing::post;
    use std::sync::{Arc, Mutex};

    let seen: Arc<Mutex<Vec<(Option<String>, serde_json::Value)>>> = Arc::default();
    let recorder = seen.clone();
    let router = axum::Router::new().route(
        route,
        post(move |headers: HeaderMap, axum::Json(body): axum::Json<serde_json::Value>| {
            let recorder = recorder.clone();
            let reply = reply.clone();
            async move {
                let authorization =
                    headers.get("authorization").and_then(|v| v.to_str().ok()).map(str::to_string);
                recorder.lock().unwrap().push((authorization, body));
                (StatusCode::from_u16(status).unwrap(), axum::Json(reply))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (addr, seen)
}

async fn probe_responses(base_url: String) -> super::types::ProviderProbeView {
    super::deepseek::validate_deepseek_token_view(
        super::types::DeepSeekTokenValidationRequest {
            api_key: "sk-openai".into(),
            base_url,
            model: "gpt-5.6-luna".into(),
            api_protocol: "openai_responses".into(),
        },
        retainpdf_core::config::DeepSeekRuntimeConfig {
            default_base_url: "https://api.deepseek.com/v1".into(),
            balance_url: String::new(),
            probe_timeout_secs: 5,
            allow_private_urls: true,
        },
        test_policy(5),
    )
    .await
    .unwrap()
}

/// Responses 协议的探针走 `/responses` + Bearer,`input` 代替 `messages`。
#[tokio::test]
async fn responses_probe_uses_the_responses_api() {
    let ok = serde_json::json!({"status": "completed", "output": []});
    let (addr, seen) = fake_provider("/v1/responses", 200, ok).await;

    let view = probe_responses(format!("http://{addr}/v1")).await;

    assert!(view.ok, "{}", view.summary);
    let seen = seen.lock().unwrap();
    let (authorization, body) = &seen[0];
    assert_eq!(authorization.as_deref(), Some("Bearer sk-openai"));
    assert_eq!(body["model"], "gpt-5.6-luna");
    assert_eq!(body["input"], "ping");
    assert_eq!(body["max_output_tokens"], 16);
    assert_eq!(body["store"], false);
    assert!(body.get("messages").is_none());
}

/// 地址误填成完整的 `/responses` 也认,不会拼出 `/responses/responses`。
#[test]
fn responses_url_accepts_a_full_endpoint() {
    use super::deepseek::responses_url;
    for base in [
        "https://api.openai.com/v1",
        "https://api.openai.com/v1/",
        "https://api.openai.com/v1/responses",
        "https://api.openai.com/v1/chat/completions",
    ] {
        assert_eq!(responses_url(base), "https://api.openai.com/v1/responses", "{base}");
    }
}

/// 只实现了 `/chat/completions` 的服务商:`/responses` 404 时说「不支持这个接口」,不说「模型不可用」。
#[tokio::test]
async fn responses_probe_explains_a_missing_endpoint() {
    let (addr, _) = fake_provider("/v1/other", 200, serde_json::json!({})).await;

    let view = probe_responses(format!("http://{addr}/v1")).await;

    assert!(!view.ok);
    assert_eq!(view.status, "provider_error");
    assert!(view.summary.contains("/responses"), "{}", view.summary);
    assert!(view.operator_hint.unwrap().contains("/chat/completions"));
}

/// 正文明确提到模型的 404 仍然是模型问题。
#[tokio::test]
async fn responses_probe_keeps_model_errors_as_model_errors() {
    let reply = serde_json::json!({"error": {"message": "The model `gpt-x` does not exist", "code": "model_not_found"}});
    let (addr, _) = fake_provider("/v1/responses", 404, reply).await;

    let view = probe_responses(format!("http://{addr}/v1")).await;

    assert_eq!(view.status, "model_unavailable", "{}", view.summary);
}

/// 官方 SDK 的地址写法（不带 `/v1`）也要能用：以前会请求到 `…/messages`，Anthropic 回 404，
/// 探针还误报成「模型不可用」。
#[test]
fn anthropic_messages_url_accepts_the_sdk_style_base_url() {
    use super::deepseek::anthropic_messages_url;
    for (base, expected) in [
        ("https://api.anthropic.com", "https://api.anthropic.com/v1/messages"),
        ("https://api.anthropic.com/", "https://api.anthropic.com/v1/messages"),
        ("https://api.anthropic.com/v1", "https://api.anthropic.com/v1/messages"),
        ("https://api.anthropic.com/v1/messages", "https://api.anthropic.com/v1/messages"),
        ("https://proxy.example.com/anthropic", "https://proxy.example.com/anthropic/v1/messages"),
    ] {
        assert_eq!(anthropic_messages_url(base), expected, "{base}");
    }
}

/// 服务商根本没回 HTTP 响应时（连不上 / 超时 / 连接中途断开），提示不能把锅扣给 Key：
/// 以前没匹配上几个关键词就报「翻译 API Key 校验失败」，开发环境里就撞到过一次——
/// 同一个 Key 直接调 Anthropic 是好的。
#[tokio::test]
async fn transport_failures_never_blame_the_api_key() {
    use super::deepseek::validate_deepseek_token_view;
    use super::types::DeepSeekTokenValidationRequest;
    use retainpdf_core::config::DeepSeekRuntimeConfig;
    use tokio::io::AsyncReadExt;

    async fn probe(base_url: String) -> super::types::ProviderProbeView {
        validate_deepseek_token_view(
            DeepSeekTokenValidationRequest {
                api_key: "sk-test".into(),
                base_url,
                model: "claude-opus-5-5".into(),
                api_protocol: "anthropic".into(),
            },
            DeepSeekRuntimeConfig {
                default_base_url: "https://api.deepseek.com/v1".into(),
                balance_url: String::new(),
                probe_timeout_secs: 1,
                allow_private_urls: true,
            },
            test_policy(1),
        )
        .await
        .unwrap()
    }

    // 连不上：端口上没人。
    let closed = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let closed_addr = closed.local_addr().unwrap();
    drop(closed);
    // 超时：收下连接，一直不回。
    let silent = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let silent_addr = silent.local_addr().unwrap();
    tokio::spawn(async move {
        let mut held = Vec::new();
        while let Ok((socket, _)) = silent.accept().await {
            held.push(socket);
        }
    });
    // 中途断开：读完请求就关连接，不回任何东西。
    let hangup = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let hangup_addr = hangup.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = hangup.accept().await {
            let mut buf = [0u8; 4096];
            let _ = socket.read(&mut buf).await;
            drop(socket);
        }
    });

    for (addr, expected) in [
        (closed_addr, "连不上翻译 API"),
        (silent_addr, "超时"),
        (hangup_addr, "中途失败"),
    ] {
        let view = probe(format!("http://{addr}/v1")).await;
        assert!(!view.ok);
        assert_eq!(view.status, "network_error", "{expected}: {}", view.summary);
        assert!(view.summary.contains(expected), "{expected}: {}", view.summary);
        assert!(!view.summary.contains("Key"), "不能怪 Key：{}", view.summary);
        assert!(view.operator_hint.as_deref().unwrap_or_default().contains("和 Key 无关"));
        assert!(view.retryable);
    }
}

async fn probe_anthropic(base_url: String, api_key: &str, model: &str) -> super::types::ProviderProbeView {
    super::deepseek::validate_deepseek_token_view(
        super::types::DeepSeekTokenValidationRequest {
            api_key: api_key.into(),
            base_url,
            model: model.into(),
            api_protocol: "anthropic".into(),
        },
        retainpdf_core::config::DeepSeekRuntimeConfig {
            default_base_url: "https://api.deepseek.com/v1".into(),
            balance_url: String::new(),
            probe_timeout_secs: 5,
            allow_private_urls: true,
        },
        test_policy(5),
    )
    .await
    .unwrap()
}

/// Key 里混进换行这种放不进请求头的字符：直说是 Key 的问题，不能说成地址不对、更不能说「和 Key 无关」。
#[tokio::test]
async fn api_key_with_a_newline_is_blamed_on_the_key() {
    let view = probe_anthropic("http://127.0.0.1:9/v1".into(), "sk-ant-abc\ndef", "claude-opus-5-5").await;
    assert!(!view.ok);
    assert_eq!(view.status, "invalid_input");
    assert!(view.summary.contains("API Key"), "{}", view.summary);
    assert!(!view.retryable);
}

/// 不填模型时只查模型列表：Anthropic 也要按同一套地址规则补 /v1，不然官方写法会 404。
#[tokio::test]
async fn anthropic_models_probe_uses_the_same_v1_rule() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buf = vec![0u8; 8192];
        let n = socket.read(&mut buf).await.unwrap();
        let request_line = String::from_utf8_lossy(&buf[..n]).lines().next().unwrap_or_default().to_string();
        let body = r#"{"data":[{"id":"claude-opus-5-5"}]}"#;
        let reply = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        socket.write_all(reply.as_bytes()).await.unwrap();
        request_line
    });
    let view = probe_anthropic(format!("http://{addr}"), "sk-ant-test", "").await;
    assert_eq!(server.await.unwrap(), "GET /v1/models HTTP/1.1");
    assert!(view.ok, "{} {}", view.status, view.summary);
}

/// MinerU 回 401 / 403 却没带错误码：就是 Token 不对，不该让人「稍后重试」。
#[test]
fn classify_probe_error_maps_bare_http_401_to_unauthorized() {
    for text in ["MinerU HTTP 401: Unauthorized", "MinerU HTTP 403: forbidden"] {
        let view = classify_probe_error(
            text.to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert_eq!(view.status, "unauthorized", "{text}");
        assert_eq!(view.summary, "MinerU Token 无效");
        assert!(!view.retryable);
    }
}

// --- MinerU 探针走真实的错误链 ------------------------------------------------
// 以前只喂手写字符串，`err.to_string()` 只给最外层的 context，401、过期、超时全落成 provider_error。

fn mineru_runtime_for_test() -> retainpdf_core::config::MineruRuntimeConfig {
    // 正式任务的超时留着 120 秒：校验要用 `test_policy` 给的短超时，不看它。
    let mut runtime = retainpdf_core::config::MineruRuntimeConfig::from_env();
    runtime.request_timeout_secs = 120;
    runtime.allow_private_urls = false;
    runtime
}

async fn probe_mineru(base_url: String) -> super::types::ProviderProbeView {
    super::ocr::validate_mineru_token_view(
        super::types::MineruTokenValidationRequest {
            mineru_token: "mineru-test-token".into(),
            base_url,
            model_version: String::new(),
        },
        mineru_runtime_for_test(),
        test_policy(1),
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn mineru_probe_classifies_real_provider_replies() {
    let cases = [
        (401, serde_json::json!({"msg": "unauthorized"}), "unauthorized"),
        (200, serde_json::json!({"code": "A0202", "msg": "invalid token", "trace_id": "t-1"}), "unauthorized"),
        (200, serde_json::json!({"code": "A0211", "msg": "token expired", "trace_id": "t-2"}), "expired"),
    ];
    for (status, reply, expected) in cases {
        let (addr, seen) = fake_provider("/api/v4/file-urls/batch", status, reply.clone()).await;
        let view = probe_mineru(format!("http://{addr}")).await;
        assert!(!view.ok, "{reply}");
        assert_eq!(view.status, expected, "{reply}: {}", view.summary);
        assert!(!view.retryable, "{reply}");
        assert_eq!(seen.lock().unwrap()[0].0.as_deref(), Some("Bearer mineru-test-token"));
    }
}

#[tokio::test]
async fn mineru_probe_reports_a_hanging_server_as_network_error() {
    let silent = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = silent.local_addr().unwrap();
    tokio::spawn(async move {
        let mut held = Vec::new();
        while let Ok((socket, _)) = silent.accept().await {
            held.push(socket);
        }
    });
    let started = std::time::Instant::now();
    let view = probe_mineru(format!("http://{addr}")).await;
    assert!(started.elapsed() < std::time::Duration::from_secs(10), "用的是校验的超时，不是任务的 120 秒");
    assert!(!view.ok);
    assert_eq!(view.status, "network_error", "{}", view.summary);
    assert!(view.summary.contains("超时"), "{}", view.summary);
    assert!(view.retryable);
}

// --- 超时、重试、重定向 ---------------------------------------------------------

/// 收下连接、一直不回，记下一共来了几次连接。
async fn silent_server() -> (std::net::SocketAddr, std::sync::Arc<std::sync::atomic::AtomicUsize>) {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let accepted = std::sync::Arc::new(AtomicUsize::new(0));
    let counter = accepted.clone();
    tokio::spawn(async move {
        let mut held = Vec::new();
        while let Ok((socket, _)) = listener.accept().await {
            counter.fetch_add(1, Ordering::SeqCst);
            held.push(socket);
        }
    });
    (addr, accepted)
}

fn paddle_runtime_for_test() -> retainpdf_core::config::PaddleRuntimeConfig {
    // 正式任务：120 秒、重试 3 次。校验两样都不该用。
    let mut runtime = retainpdf_core::config::PaddleRuntimeConfig::from_env();
    runtime.request_timeout_secs = 120;
    runtime.request_retry_attempts = 3;
    runtime.request_retry_base_delay_millis = 1;
    runtime.allow_private_urls = false;
    runtime
}

async fn probe_paddle(base_url: String) -> super::types::ProviderProbeView {
    super::ocr::validate_paddle_token_view(
        super::types::PaddleTokenValidationRequest {
            paddle_token: "paddle-test-token".into(),
            base_url,
        },
        paddle_runtime_for_test(),
        test_policy(1),
    )
    .await
    .unwrap()
}

/// Paddle 校验只试一次、用校验的超时：以前对端挂起时 120 秒 × 3 次加退避，前端 30 秒早放弃了。
#[tokio::test]
async fn paddle_probe_does_not_retry_and_uses_the_probe_timeout() {
    let (addr, accepted) = silent_server().await;
    let started = std::time::Instant::now();
    let view = probe_paddle(format!("http://{addr}")).await;
    assert!(started.elapsed() < std::time::Duration::from_secs(10));
    assert!(!view.ok);
    assert_eq!(view.status, "network_error", "{}", view.summary);
    assert_eq!(accepted.load(std::sync::atomic::Ordering::SeqCst), 1, "不重试");
}

/// 记下收到的每个请求（任何路径）的 `authorization`、`x-api-key` 头。
async fn recording_target() -> (
    std::net::SocketAddr,
    std::sync::Arc<std::sync::Mutex<Vec<(String, Option<String>, Option<String>)>>>,
) {
    use axum::http::{HeaderMap, Uri};
    use std::sync::{Arc, Mutex};
    let seen: Arc<Mutex<Vec<(String, Option<String>, Option<String>)>>> = Arc::default();
    let recorder = seen.clone();
    let router = axum::Router::new().fallback(move |uri: Uri, headers: HeaderMap| {
        let recorder = recorder.clone();
        async move {
            let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
            recorder.lock().unwrap().push((uri.path().to_string(), header("authorization"), header("x-api-key")));
            axum::Json(serde_json::json!({"code": 0, "msg": "ok", "data": {}}))
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    (addr, seen)
}

/// 任何路径都回 302，指到 `target`。
async fn redirecting_server(target: std::net::SocketAddr) -> std::net::SocketAddr {
    use axum::http::{header, StatusCode, Uri};
    let router = axum::Router::new().fallback(move |uri: Uri| async move {
        (StatusCode::FOUND, [(header::LOCATION, format!("http://{target}{}", uri.path()))], "")
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    addr
}

/// 三家校验都不跟随重定向：302 直接算校验没通过（`redirected`），Key 不会出现在重定向后的地址上。
/// Anthropic 的 `x-api-key` 是重点：reqwest 跨主机重定向只去掉 `Authorization`，不认识它。
#[tokio::test]
async fn probes_never_follow_redirects_or_forward_keys() {
    let (target, seen) = recording_target().await;
    let redirector = redirecting_server(target).await;
    let base = format!("http://{redirector}");

    let mut views = vec![
        ("mineru", probe_mineru(base.clone()).await),
        ("paddle", probe_paddle(base.clone()).await),
        ("anthropic", probe_anthropic(format!("{base}/v1"), "sk-ant-secret", "claude-opus-5-5").await),
        ("anthropic-models", probe_anthropic(format!("{base}/v1"), "sk-ant-secret", "").await),
        ("responses", probe_responses(format!("{base}/v1")).await),
    ];
    views.push((
        "openai",
        super::deepseek::validate_deepseek_token_view(
            super::types::DeepSeekTokenValidationRequest {
                api_key: "sk-openai-secret".into(),
                base_url: format!("{base}/v1"),
                model: "deepseek-chat".into(),
                api_protocol: String::new(),
            },
            retainpdf_core::config::DeepSeekRuntimeConfig::from_env(),
            test_policy(5),
        )
        .await
        .unwrap(),
    ));
    for (name, view) in &views {
        assert!(!view.ok, "{name}");
        assert_eq!(view.status, "redirected", "{name}: {}", view.summary);
        assert_eq!(view.provider_code.as_deref(), Some("302"), "{name}");
        assert!(!view.retryable, "{name}");
        assert!(view.summary.contains("重定向"), "{name}: {}", view.summary);
    }
    assert!(seen.lock().unwrap().is_empty(), "重定向后的地址收到了请求：{:?}", seen.lock().unwrap());
}

/// 余额接口的地址是配置里固定的，也一样不跟随。
#[tokio::test]
async fn balance_probe_never_follows_redirects() {
    let (target, seen) = recording_target().await;
    let redirector = redirecting_server(target).await;
    let mut runtime = retainpdf_core::config::DeepSeekRuntimeConfig::from_env();
    runtime.balance_url = format!("http://{redirector}/user/balance");
    let view = super::deepseek::query_deepseek_balance_view(
        super::types::DeepSeekTokenValidationRequest {
            api_key: "sk-deepseek-secret".into(),
            base_url: String::new(),
            model: String::new(),
            api_protocol: String::new(),
        },
        runtime,
        test_policy(5),
    )
    .await
    .unwrap();
    assert_eq!(view.status, "redirected", "{}", view.summary);
    assert!(!view.ok);
    assert!(seen.lock().unwrap().is_empty());
}

// --- 地址策略：单机放开本机和内网 -----------------------------------------------

#[test]
fn single_mode_allows_loopback_and_private_but_not_link_local() {
    use super::policy::PrivateTargets;
    use super::url_policy::validate_probe_base_url;
    for allowed in [
        "http://127.0.0.1:11434/v1",
        "http://localhost:11434/v1",
        "http://[::1]:8000/v1",
        "http://10.0.0.5:8000/v1",
        "http://172.16.0.5/v1",
        "http://192.168.1.5:1234/v1",
        "http://[fd00::1]/v1",
        "http://0.0.0.0:11434/v1",
        "https://api.deepseek.com/v1",
    ] {
        assert!(validate_probe_base_url(allowed, PrivateTargets::AllowLocal).is_ok(), "{allowed}");
    }
    for blocked in ["http://169.254.169.254/latest", "http://[fe80::1]/", "http://[::ffff:169.254.169.254]/"] {
        let err = validate_probe_base_url(blocked, PrivateTargets::AllowLocal).unwrap_err();
        assert!(err.to_string().contains("link-local"), "{blocked}: {err}");
    }
    // 别的检查照旧。
    assert!(validate_probe_base_url("ftp://127.0.0.1", PrivateTargets::AllowLocal).is_err());
    assert!(validate_probe_base_url("http://u:p@127.0.0.1", PrivateTargets::AllowLocal).is_err());
}

#[test]
fn multi_mode_still_blocks_local_targets() {
    use super::policy::PrivateTargets;
    use super::url_policy::validate_probe_base_url;
    for blocked in ["http://127.0.0.1:11434", "http://localhost:11434", "http://192.168.1.5", "http://169.254.169.254"] {
        assert!(validate_probe_base_url(blocked, PrivateTargets::Block).is_err(), "{blocked}");
    }
    assert!(validate_probe_base_url("http://169.254.169.254", PrivateTargets::AllowAll).is_ok());
}

/// 单机下本机的模型服务（Ollama 之类）能校验：以前 400「localhost/private targets are blocked」。
#[tokio::test]
async fn single_mode_probe_reaches_a_local_model_server() {
    let ok = serde_json::json!({"choices": [{"message": {"content": "p"}}]});
    let (addr, seen) = fake_provider("/v1/chat/completions", 200, ok).await;
    let view = super::deepseek::validate_deepseek_token_view(
        super::types::DeepSeekTokenValidationRequest {
            api_key: "ollama".into(),
            base_url: format!("http://{addr}/v1"),
            model: "qwen3".into(),
            api_protocol: String::new(),
        },
        retainpdf_core::config::DeepSeekRuntimeConfig::from_env(),
        super::policy::ProbePolicy::new(5, super::policy::PrivateTargets::AllowLocal),
    )
    .await
    .unwrap();
    assert!(view.ok, "{} {}", view.status, view.summary);
    assert_eq!(seen.lock().unwrap().len(), 1);
}

// --- 请求体和返回 ---------------------------------------------------------------

/// 拼错的字段 400，不再静默走默认地址；调用方（前端、CLI）发的字段都认。
#[test]
fn probe_requests_reject_unknown_fields() {
    use super::types::{DeepSeekTokenValidationRequest, MineruTokenValidationRequest, PaddleTokenValidationRequest};
    use serde_json::json;
    assert!(serde_json::from_value::<MineruTokenValidationRequest>(json!({"mineru_token": "t"})).is_ok());
    assert!(serde_json::from_value::<MineruTokenValidationRequest>(
        json!({"mineru_token": "t", "base_url": "https://mineru.net", "model_version": "vlm"})
    )
    .is_ok());
    assert!(serde_json::from_value::<MineruTokenValidationRequest>(json!({"mineru_token": "t", "baseurl": "x"})).is_err());
    assert!(serde_json::from_value::<PaddleTokenValidationRequest>(
        json!({"paddle_token": "t", "base_url": "https://paddleocr.aistudio-app.com"})
    )
    .is_ok());
    assert!(serde_json::from_value::<PaddleTokenValidationRequest>(json!({"paddle_token": "t", "token": "x"})).is_err());
    let cli_body = json!({"api_key": "k", "base_url": "https://api.deepseek.com/v1", "model": "m", "api_protocol": "openai"});
    assert!(serde_json::from_value::<DeepSeekTokenValidationRequest>(cli_body).is_ok());
    assert!(serde_json::from_value::<DeepSeekTokenValidationRequest>(json!({"api_key": "k", "base_url": "u"})).is_ok());
    assert!(serde_json::from_value::<DeepSeekTokenValidationRequest>(json!({"api_key": "k", "protocol": "anthropic"})).is_err());
}

/// 服务商的错误正文是 JSON 但不带 `error.message` / `message` 时，整段正文会当 `provider_message`：
/// 截到 500 字，不整段转给前端。
#[tokio::test]
async fn provider_message_is_truncated() {
    use axum::http::StatusCode;
    let body = serde_json::json!({"detail": "错".repeat(3000)});
    let router = axum::Router::new().fallback(move || {
        let body = body.clone();
        async move { (StatusCode::BAD_GATEWAY, axum::Json(body)) }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let view = probe_responses(format!("http://{addr}/v1")).await;
    assert!(!view.ok);
    let message = view.provider_message.unwrap();
    assert!(message.chars().count() <= super::policy::PROVIDER_MESSAGE_MAX_CHARS + 1, "{}", message.chars().count());
    assert!(message.ends_with('…'));
}

async fn probe_openai_chat(base_url: String) -> super::types::ProviderProbeView {
    super::deepseek::validate_deepseek_token_view(
        super::types::DeepSeekTokenValidationRequest {
            api_key: "sk-openai".into(),
            base_url,
            model: "gpt-5.6-luna".into(),
            api_protocol: "openai".into(),
        },
        retainpdf_core::config::DeepSeekRuntimeConfig {
            default_base_url: "https://api.deepseek.com/v1".into(),
            balance_url: String::new(),
            probe_timeout_secs: 5,
            allow_private_urls: true,
        },
        test_policy(5),
    )
    .await
    .unwrap()
}

/// issue #161：OpenAI 新模型不认 `max_tokens`（400，param=max_tokens），探针换 `max_completion_tokens` 再发一次，
/// 不再报「模型不可用」。
#[tokio::test]
async fn openai_chat_probe_retries_with_max_completion_tokens() {
    use axum::http::StatusCode;
    use axum::routing::post;
    use std::sync::{Arc, Mutex};

    let seen: Arc<Mutex<Vec<serde_json::Value>>> = Arc::default();
    let recorder = seen.clone();
    let router = axum::Router::new().route(
        "/v1/chat/completions",
        post(move |axum::Json(body): axum::Json<serde_json::Value>| {
            let recorder = recorder.clone();
            async move {
                recorder.lock().unwrap().push(body.clone());
                if body.get("max_tokens").is_some() {
                    let error = serde_json::json!({"error": {
                        "message": "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
                        "type": "invalid_request_error", "param": "max_tokens", "code": "unsupported_parameter"}});
                    (StatusCode::BAD_REQUEST, axum::Json(error))
                } else {
                    (StatusCode::OK, axum::Json(serde_json::json!({"choices": [{"message": {"content": ""}}]})))
                }
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    let view = probe_openai_chat(format!("http://{addr}/v1")).await;

    assert!(view.ok, "{}", view.summary);
    let seen = seen.lock().unwrap();
    assert_eq!(seen.len(), 2);
    assert_eq!(seen[0]["max_tokens"], 1);
    assert_eq!(seen[1]["max_completion_tokens"], 16);
    assert!(seen[1].get("max_tokens").is_none());
}

/// 别的服务商照旧只发一次 `max_tokens: 1`。
#[tokio::test]
async fn openai_chat_probe_sends_max_tokens_once_when_accepted() {
    let ok = serde_json::json!({"choices": [{"message": {"content": "p"}}]});
    let (addr, seen) = fake_provider("/v1/chat/completions", 200, ok).await;

    let view = probe_openai_chat(format!("http://{addr}/v1")).await;

    assert!(view.ok, "{}", view.summary);
    let seen = seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    assert_eq!(seen[0].1["max_tokens"], 1);
}

/// 参数不被接受（正文里有 "this model"）不是模型不可用：说清是哪个参数，带上上游错误码，不建议重试。
#[tokio::test]
async fn openai_chat_probe_reports_parameter_errors_as_such() {
    let reply = serde_json::json!({"error": {
        "message": "Unsupported value: 'stream' does not support false with this model.",
        "type": "invalid_request_error", "param": "stream", "code": "unsupported_value"}});
    let (addr, seen) = fake_provider("/v1/chat/completions", 400, reply).await;

    let view = probe_openai_chat(format!("http://{addr}/v1")).await;

    assert_eq!(view.status, "provider_error", "{}", view.summary);
    assert!(view.summary.contains("stream") && view.summary.contains("gpt-5.6-luna"), "{}", view.summary);
    assert!(!view.retryable);
    assert!(view.provider_message.unwrap().contains("unsupported_value"));
    assert_eq!(seen.lock().unwrap().len(), 1, "不是 max_tokens 的问题，不重发");
}

/// 模型真不存在照旧是模型不可用。
#[tokio::test]
async fn openai_chat_probe_keeps_model_not_found() {
    let reply = serde_json::json!({"error": {
        "message": "The model `gpt-x` does not exist or you do not have access to it.",
        "type": "invalid_request_error", "param": null, "code": "model_not_found"}});
    let (addr, _) = fake_provider("/v1/chat/completions", 404, reply).await;

    let view = probe_openai_chat(format!("http://{addr}/v1")).await;

    assert_eq!(view.status, "model_unavailable", "{}", view.summary);
}

#[test]
fn upstream_error_tells_parameter_errors_from_model_errors() {
    use super::deepseek::UpstreamError;
    let parse = |body: serde_json::Value| UpstreamError::parse(&body.to_string());
    let param = parse(serde_json::json!({"error": {"message": "x", "param": "temperature", "code": "unsupported_value"}}));
    assert_eq!(param.rejected_parameter().as_deref(), Some("temperature"));
    let model = parse(serde_json::json!({"error": {"message": "x", "param": "model", "code": "invalid_value"}}));
    assert_eq!(model.rejected_parameter(), None);
    let not_found = parse(serde_json::json!({"error": {"message": "x", "code": "model_not_found"}}));
    assert_eq!(not_found.rejected_parameter(), None);
    let chinese = parse(serde_json::json!({"error": {"message": "模型不存在"}}));
    assert_eq!(chinese.rejected_parameter(), None);
    let text_only = parse(serde_json::json!({"error": {"message": "Unsupported parameter: 'foo'"}}));
    assert_eq!(text_only.rejected_parameter().as_deref(), Some(""));
}
