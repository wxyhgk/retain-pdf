//! 密钥校验接口：不认识的字段 400；单机能校验本机的模型服务，多用户照旧拦。

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;

use crate::api_tests::accounts::{login, multi_state, send, ADMIN_PASSWORD};
use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

/// 本机的假模型服务：`/v1/chat/completions` 回 200。
pub(super) async fn local_model_server() -> std::net::SocketAddr {
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

pub(super) async fn post_single(state: crate::AppState, uri: &str, body: Value) -> (StatusCode, Value) {
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

pub(super) fn no_private_escape(mut state: crate::AppState) -> crate::AppState {
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

    // 契约 translation-providers.v1（2026-11-19）：真实返回的键和契约的 required 一一对上。
    let contract: Value = serde_json::from_str(
        &std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../contracts/translation-providers.v1.schema.json"))
            .expect("read contract"),
    )
    .unwrap();
    let keys = |value: &Value| {
        let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    };
    let required = |name: &str| {
        let mut keys: Vec<String> = contract["definitions"][name]["required"].as_array().unwrap().iter().map(|k| k.as_str().unwrap().to_string()).collect();
        keys.sort();
        keys
    };
    assert_eq!(keys(data), required("TranslationModelListView"));
    assert_eq!(keys(&data["models"][0]), required("TranslationModelView"));
    assert_eq!(keys(&data["models"][0]["price"]), required("PriceView"));
    let statuses = contract["definitions"]["TranslationModelListStatus"]["enum"].as_array().unwrap();
    assert!(statuses.contains(&data["status"]));

    let (status, _) = post_single(
        state,
        "/api/v1/providers/translation/models",
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "x"}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "多余字段");
}

/// 用翻译接口问一次模型、带图片（2026-11-22）经真实路由：图片按 OpenAI Chat 的写法转给服务商，回答原样带回；
/// 返回的键和契约一一对上；图片不是 base64、字段多余都是 400；Key 不回显。
#[tokio::test]
async fn translation_ask_route_sends_images_to_the_provider() {
    let seen = std::sync::Arc::new(std::sync::Mutex::new(Value::Null));
    let recorder = seen.clone();
    let router = axum::Router::new().route(
        "/v1/chat/completions",
        axum::routing::post(move |axum::Json(body): axum::Json<Value>| {
            let recorder = recorder.clone();
            async move {
                *recorder.lock().unwrap() = body;
                axum::Json(json!({"choices": [{"message": {"content": "两张表一样"}}], "usage": {"prompt_tokens": 812, "completion_tokens": 6}}))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let state = no_private_escape(test_state("provider-ask"));
    let png = "iVBORw0KGgpmYWtl";

    let (status, payload) = post_single(
        state.clone(),
        "/api/v1/providers/translation/ask",
        json!({
            "base_url": format!("http://{addr}/v1"), "api_key": "sk-local-not-real", "model": "qwen-vl",
            "system": "你是排版检查员。", "prompt": "这两张表一样吗？",
            "images": [{"media_type": "image/png", "data": png}, {"media_type": "image/jpeg", "data": png}],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_eq!((data["ok"].as_bool(), data["status"].as_str(), data["text"].as_str()), (Some(true), Some("ok"), Some("两张表一样")));
    assert_eq!((data["images"].as_u64(), data["usage"]["input_tokens"].as_u64()), (Some(2), Some(812)));
    assert!(!payload.to_string().contains("sk-local-not-real"));
    let sent = seen.lock().unwrap().clone();
    assert_eq!(sent["model"], "qwen-vl");
    assert_eq!(sent["messages"][0], json!({"role": "system", "content": "你是排版检查员。"}));
    let content = &sent["messages"][1]["content"];
    assert_eq!(content[0], json!({"type": "text", "text": "这两张表一样吗？"}));
    assert_eq!(content[1]["image_url"]["url"], format!("data:image/png;base64,{png}"));
    assert_eq!(content[2]["image_url"]["url"], format!("data:image/jpeg;base64,{png}"));

    // 契约 translation-providers.v1：真实返回的键和契约的 required 一一对上。
    let contract: Value = serde_json::from_str(
        &std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../contracts/translation-providers.v1.schema.json"))
            .expect("read contract"),
    )
    .unwrap();
    let keys = |value: &Value| {
        let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    };
    let required = |name: &str| {
        let mut keys: Vec<String> = contract["definitions"][name]["required"].as_array().unwrap().iter().map(|k| k.as_str().unwrap().to_string()).collect();
        keys.sort();
        keys
    };
    assert_eq!(keys(data), required("TranslationModelAskView"));
    assert_eq!(keys(&data["usage"]), required("AskUsageView"));
    assert!(contract["definitions"]["TranslationModelAskStatus"]["enum"].as_array().unwrap().contains(&data["status"]));

    for body in [
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "m", "prompt": "p", "images": [{"media_type": "image/png", "data": "not base64!"}]}),
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "m", "prompt": "p", "images": [{"media_type": "image/tiff", "data": png}]}),
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "m", "prompt": ""}),
        json!({"base_url": format!("http://{addr}/v1"), "api_key": "sk", "model": "m", "prompt": "p", "temperature": 0}),
    ] {
        let (status, payload) = post_single(state.clone(), "/api/v1/providers/translation/ask", body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    }
}

/// 带图片的请求体比默认的 2 MB 大：问模型的接口放宽到 24 MB。
#[tokio::test]
async fn translation_ask_accepts_bodies_larger_than_the_default_limit() {
    let state = no_private_escape(test_state("provider-ask-large-body"));
    use base64::Engine;
    let image = base64::engine::general_purpose::STANDARD.encode(vec![0u8; 3 * 1024 * 1024]);
    // 本机没人监听的端口，马上连不上：只看请求体有没有被收下（不是 413），结果是 unreachable 也行
    let (status, payload) = post_single(
        state,
        "/api/v1/providers/translation/ask",
        json!({"base_url": "http://127.0.0.1:9/v1", "api_key": "sk", "model": "m", "prompt": "p", "images": [{"media_type": "image/png", "data": image}]}),
    )
    .await;
    assert_ne!(status, StatusCode::PAYLOAD_TOO_LARGE, "{payload}");
}
