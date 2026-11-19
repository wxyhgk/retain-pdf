//! 密钥校验接口：不认识的字段 400；单机能校验本机的模型服务，多用户照旧拦。

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;

use crate::api_tests::accounts::{login, multi_state, send, ADMIN_PASSWORD};
use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

/// 本机的假模型服务：`/v1/chat/completions` 回 200。
async fn local_model_server() -> std::net::SocketAddr {
    let router = axum::Router::new().route(
        "/v1/chat/completions",
        axum::routing::post(|| async { axum::Json(json!({"choices": [{"message": {"content": "p"}}]})) }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    addr
}

async fn post_single(state: crate::AppState, uri: &str, body: Value) -> (StatusCode, Value) {
    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(uri)
                .header("x-api-key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn no_private_escape(mut state: crate::AppState) -> crate::AppState {
    // 开发机上可能设了 RUST_API_ALLOW_PRIVATE_PROVIDER_URLS=1：测试按默认（没设）来。
    let mut config = (*state.config).clone();
    config.provider_runtime.mineru.allow_private_urls = false;
    config.provider_runtime.paddle.allow_private_urls = false;
    config.provider_runtime.deepseek.allow_private_urls = false;
    state.config = std::sync::Arc::new(config);
    state
}

#[tokio::test]
async fn probe_requests_with_unknown_fields_are_rejected() {
    let state = no_private_escape(test_state("provider-probes-unknown-fields"));
    for (uri, body) in [
        ("/api/v1/providers/mineru/validate-token", json!({"mineru_token": "t", "baseurl": "https://x"})),
        ("/api/v1/providers/paddle/validate-token", json!({"paddle_token": "t", "token": "x"})),
        ("/api/v1/providers/deepseek/validate-token", json!({"api_key": "k", "protocol": "anthropic"})),
        ("/api/v1/providers/deepseek/balance", json!({"api_key": "k", "url": "https://x"})),
    ] {
        let (status, payload) = post_single(state.clone(), uri, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}: {payload}");
        assert!(payload["message"].as_str().unwrap_or_default().contains("unknown field"), "{uri}: {payload}");
    }
}

/// 单机：本机的 Ollama、vLLM 之类能校验（以前 400「localhost/private targets are blocked」）。
#[tokio::test]
async fn single_mode_probe_can_reach_a_local_model_server() {
    let state = no_private_escape(test_state("provider-probes-single-local"));
    let addr = local_model_server().await;
    let (status, payload) = post_single(
        state,
        "/api/v1/providers/deepseek/validate-token",
        json!({"api_key": "ollama", "base_url": format!("http://{addr}/v1"), "model": "qwen3"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["ok"], true, "{payload}");
    assert_eq!(payload["data"]["status"], "valid", "{payload}");
}

/// 多用户：行为不变，本机和内网地址照旧 400。
#[tokio::test]
async fn multi_mode_probe_still_blocks_local_targets() {
    let state = no_private_escape(multi_state("provider-probes-multi-local"));
    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let addr = local_model_server().await;
    let response = send(
        &state,
        Method::POST,
        "/api/v1/providers/deepseek/validate-token",
        Some(&cookie),
        Some(json!({"api_key": "k", "base_url": format!("http://{addr}/v1"), "model": "m"})),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = read_json(response).await;
    assert!(payload["message"].as_str().unwrap_or_default().contains("not allowed"), "{payload}");
}

/// 拉取翻译接口的模型列表（2026-11-19）经真实路由：单机能连本机的服务（Ollama、vLLM），带单价；多余字段 400。
#[tokio::test]
async fn translation_model_list_route_proxies_the_provider_models() {
    let router = axum::Router::new().route(
        "/v1/models",
        axum::routing::get(|| async {
            axum::Json(json!({"data": [{"id": "qwen3.8-flash", "owned_by": "local"}, {"id": "text-embedding-v4"}]}))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let state = no_private_escape(test_state("provider-model-list"));

    let (status, payload) = post_single(
        state.clone(),
        "/api/v1/providers/translation/models",
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk-local-not-real", "api_protocol": "openai"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_eq!((data["ok"].as_bool(), data["status"].as_str(), data["chat_models"].as_u64()), (Some(true), Some("ok"), Some(1)));
    assert_eq!(data["models"][0]["id"], "qwen3.8-flash");
    assert_eq!(data["models"][0]["price_basis"], "official_list", "本机地址按官方标价");
    assert_eq!(data["models"][1]["kind"], "other");
    assert!(!payload.to_string().contains("sk-local-not-real"));

    let (status, _) = post_single(
        state,
        "/api/v1/providers/translation/models",
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "x"}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "多余字段");
}
