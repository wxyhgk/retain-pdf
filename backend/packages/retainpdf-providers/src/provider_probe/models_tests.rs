use std::sync::{Arc, Mutex};

use axum::extract::Query;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::get;
use serde_json::json;

use super::*;
use crate::provider_probe::PrivateTargets;

fn policy() -> ProbePolicy {
    ProbePolicy::new(5, PrivateTargets::AllowAll)
}

fn runtime() -> DeepSeekRuntimeConfig {
    DeepSeekRuntimeConfig {
        default_base_url: "https://api.deepseek.com/v1".into(),
        balance_url: String::new(),
        probe_timeout_secs: 5,
        allow_private_urls: true,
    }
}

type Seen = Arc<Mutex<Vec<(HeaderMap, std::collections::HashMap<String, String>)>>>;

/// 本地假服务商：`GET route` 依次回 `replies`（最后一个重复用），记下请求头和查询参数。
async fn fake(route: &'static str, replies: Vec<(u16, String)>) -> (std::net::SocketAddr, Seen) {
    let seen: Seen = Arc::default();
    let recorder = seen.clone();
    let replies = Arc::new(replies);
    let router = axum::Router::new().route(
        route,
        get(move |headers: HeaderMap, Query(query): Query<std::collections::HashMap<String, String>>| {
            let recorder = recorder.clone();
            let replies = replies.clone();
            async move {
                let index = {
                    let mut seen = recorder.lock().unwrap();
                    seen.push((headers, query));
                    seen.len() - 1
                };
                let (status, body) = replies[index.min(replies.len() - 1)].clone();
                (StatusCode::from_u16(status).unwrap(), body)
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

fn request(base_url: String, protocol: &str) -> TranslationModelsRequest {
    TranslationModelsRequest { api_key: "sk-list-models-secret".into(), base_url, api_protocol: protocol.into() }
}

#[tokio::test]
async fn openai_models_are_sorted_deduplicated_classified_and_priced() {
    let body = json!({"object": "list", "data": [
        {"id": "text-embedding-3-small", "owned_by": "openai", "created": 1},
        {"id": "deepseek-flash", "owned_by": "deepseek", "created": 2},
        {"id": "claude-haiku-5-5"},
        {"id": "deepseek-flash", "owned_by": "dup"},
        {"id": "whisper-1"}
    ]});
    let (addr, seen) = fake("/v1/models", vec![(200, body.to_string())]).await;
    let view = list_translation_models_view(request(format!("http://{addr}/v1"), "openai"), runtime(), policy(), Some(Path::new("/nonexistent-root")))
        .await
        .unwrap();
    assert!(view.ok, "{}", view.summary);
    assert_eq!(view.models.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(), ["claude-haiku-5-5", "deepseek-flash", "text-embedding-3-small", "whisper-1"]);
    assert_eq!(view.models.iter().map(|m| m.kind).collect::<Vec<_>>(), ["chat", "chat", "other", "other"]);
    assert_eq!(view.chat_models, 2);
    let flash = &view.models[1];
    assert_eq!((flash.owned_by.as_deref(), flash.created), (Some("deepseek"), Some(2)), "重复的留第一条");
    assert_eq!((flash.price_provider.as_deref(), flash.price_basis), (Some("deepseek"), Some(PriceBasis::OfficialList)), "本地地址按官方标价");
    assert_eq!(flash.price.as_ref().unwrap().peak_multiplier, 2.0);
    assert!(view.models[3].price.is_none(), "查不到价是 null");
    let headers = &seen.lock().unwrap()[0].0;
    assert_eq!(headers.get("authorization").unwrap(), "Bearer sk-list-models-secret");
    assert!(!serde_json::to_string(&view).unwrap().contains("sk-list-models-secret"), "Key 不回显");
}

#[tokio::test]
async fn anthropic_models_are_paged_with_the_anthropic_headers() {
    let page1 = json!({"data": [{"id": "claude-opus-5-5", "display_name": "Claude Opus 5.5", "created_at": "2026-10-01T00:00:00Z"}], "has_more": true, "last_id": "claude-opus-5-5"});
    let page2 = json!({"data": [{"id": "claude-haiku-5-5", "display_name": "Claude Haiku 5.5"}], "has_more": false, "last_id": "claude-haiku-5-5"});
    let (addr, seen) = fake("/v1/models", vec![(200, page1.to_string()), (200, page2.to_string())]).await;
    let view = list_translation_models_view(request(format!("http://{addr}"), "anthropic"), runtime(), policy(), None).await.unwrap();
    assert!(view.ok, "{}", view.summary);
    assert_eq!(view.models.iter().map(|m| (m.id.as_str(), m.display_name.as_deref())).collect::<Vec<_>>(), [
        ("claude-haiku-5-5", Some("Claude Haiku 5.5")),
        ("claude-opus-5-5", Some("Claude Opus 5.5")),
    ]);
    assert!(view.models[0].price.is_none(), "没给价格表时不带价");
    let seen = seen.lock().unwrap();
    assert_eq!(seen.len(), 2);
    assert_eq!(seen[0].0.get("x-api-key").unwrap(), "sk-list-models-secret");
    assert_eq!(seen[0].0.get("anthropic-version").unwrap(), "2023-06-01");
    assert!(seen[0].0.get("authorization").is_none());
    assert_eq!(seen[1].1.get("after_id").map(String::as_str), Some("claude-opus-5-5"));
}

#[tokio::test]
async fn providers_without_a_model_list_say_so_and_errors_are_redacted() {
    let (missing, _) = fake("/v1/models", vec![(404, "not found".into())]).await;
    let view = list_translation_models_view(request(format!("http://{missing}/v1"), ""), runtime(), policy(), None).await.unwrap();
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "unsupported", Some("404")));

    let (html, _) = fake("/v1/models", vec![(200, "<html>relay</html>".into())]).await;
    let view = list_translation_models_view(request(format!("http://{html}/v1"), ""), runtime(), policy(), None).await.unwrap();
    assert_eq!(view.status, "unsupported", "200 但不是 JSON 也当不支持");

    let (shape, _) = fake("/v1/models", vec![(200, json!({"object": "list"}).to_string())]).await;
    let view = list_translation_models_view(request(format!("http://{shape}/v1"), ""), runtime(), policy(), None).await.unwrap();
    assert_eq!(view.status, "unsupported", "JSON 但没有列表");

    let echo = json!({"error": {"message": "invalid key sk-list-models-secret"}}).to_string();
    let (denied, _) = fake("/v1/models", vec![(401, echo)]).await;
    let view = list_translation_models_view(request(format!("http://{denied}/v1"), ""), runtime(), policy(), None).await.unwrap();
    assert_eq!((view.status, view.provider_code.as_deref()), ("unauthorized", Some("401")));
    assert_eq!(view.provider_message.as_deref(), Some("invalid key [REDACTED]"), "服务商回显的 Key 抹掉");

    let (broken, _) = fake("/v1/models", vec![(500, "boom".into())]).await;
    let view = list_translation_models_view(request(format!("http://{broken}/v1"), ""), runtime(), policy(), None).await.unwrap();
    assert_eq!(view.status, "provider_error");
}

#[tokio::test]
async fn bad_input_is_rejected_before_any_request() {
    let empty = TranslationModelsRequest { api_key: " ".into(), base_url: "https://api.deepseek.com".into(), api_protocol: String::new() };
    assert!(list_translation_models_view(empty, runtime(), policy(), None).await.is_err(), "没有 Key 400");
    let blocked = list_translation_models_view(request("http://127.0.0.1:9/v1".into(), ""), runtime(), ProbePolicy::new(5, PrivateTargets::Block), None).await;
    assert!(blocked.is_err(), "多用户拦本机地址");
    let newline = TranslationModelsRequest { api_key: "sk-a\nb".into(), base_url: "https://api.deepseek.com".into(), api_protocol: String::new() };
    assert_eq!(list_translation_models_view(newline, runtime(), policy(), None).await.unwrap().status, "invalid_input");
}

#[test]
fn list_shapes_and_kinds() {
    let bare = parse_model_list(&json!(["qwen3.8-flash", {"id": "glm-5.3-flash"}])).unwrap();
    assert_eq!(bare.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(), ["qwen3.8-flash", "glm-5.3-flash"]);
    let gemini = parse_model_list(&json!({"models": [{"name": "models/gemini-3-flash", "displayName": "Gemini 3 Flash"}]})).unwrap();
    assert_eq!((gemini[0].id.as_str(), gemini[0].display_name.as_deref()), ("gemini-3-flash", Some("Gemini 3 Flash")));
    assert!(parse_model_list(&json!({"object": "list"})).is_none());
    for (id, kind) in [
        ("gpt-5.5", "chat"), ("deepseek-flash", "chat"), ("qwen3.8-max", "chat"), ("glm-5.3-flash", "chat"),
        ("text-embedding-v4", "other"), ("tts-1", "other"), ("dall-e-3", "other"), ("omni-moderation-latest", "other"),
        ("gte-rerank-v2", "other"), ("glm-ocr", "other"), ("gpt-image-2", "other"), ("gpt-4o-realtime-preview", "other"),
        ("qwen3-asr-flash", "other"), ("paraformer-realtime-v2", "other"),
    ] {
        assert_eq!(model_kind(id), kind, "{id}");
    }
}
