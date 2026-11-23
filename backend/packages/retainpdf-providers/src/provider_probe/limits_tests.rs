//! 三个接口（校验 Key、拉模型列表、问模型）读服务商的业务码：HTTP 状态码放 `http_status`，业务码放 `provider_code`，
//! 429 分清限流和欠费 / 额度用完（2026-11-23）。假服务商回各家真实的报错形状。

use serde_json::json;

use super::ask::{ask_translation_model_view, TranslationModelAskRequest, TranslationModelAskView};
use super::models::{list_translation_models_view, TranslationModelListView, TranslationModelsRequest};
use super::policy::{PrivateTargets, ProbePolicy};
use super::types::{DeepSeekTokenValidationRequest, ProviderProbeView};

fn runtime() -> retainpdf_core::config::DeepSeekRuntimeConfig {
    retainpdf_core::config::DeepSeekRuntimeConfig {
        default_base_url: "https://api.deepseek.com/v1".into(),
        balance_url: String::new(),
        probe_timeout_secs: 5,
        allow_private_urls: true,
    }
}

fn policy() -> ProbePolicy {
    ProbePolicy::new(5, PrivateTargets::AllowAll)
}

/// 本地假服务商：不管什么路径都回 `status` + `body`，`retry_after` 时带上 `retry-after: 20`。
async fn reply_with(status: u16, body: String, retry_after: bool) -> String {
    use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
    let router = axum::Router::new().fallback(move || {
        let body = body.clone();
        async move {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
            if retry_after {
                headers.insert(header::RETRY_AFTER, HeaderValue::from_static("20"));
            }
            (StatusCode::from_u16(status).unwrap(), headers, body)
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    format!("http://{addr}/v1")
}

async fn check_key(status: u16, body: serde_json::Value, protocol: &str, model: &str) -> ProviderProbeView {
    check_key_raw(status, body.to_string(), protocol, model).await
}

async fn check_key_raw(status: u16, body: String, protocol: &str, model: &str) -> ProviderProbeView {
    let base_url = reply_with(status, body, false).await;
    super::deepseek::validate_deepseek_token_view(
        DeepSeekTokenValidationRequest {
            api_key: "sk-probe-secret".into(),
            base_url,
            model: model.into(),
            api_protocol: protocol.into(),
        },
        runtime(),
        policy(),
    )
    .await
    .unwrap()
}

async fn ask(status: u16, body: serde_json::Value) -> TranslationModelAskView {
    let base_url = reply_with(status, body.to_string(), false).await;
    ask_translation_model_view(
        TranslationModelAskRequest {
            api_key: "sk-probe-secret".into(),
            base_url,
            api_protocol: "openai".into(),
            model: "glm-5.3-flash".into(),
            system: String::new(),
            prompt: "ping".into(),
            images: Vec::new(),
            max_tokens: None,
        },
        runtime(),
        policy(),
    )
    .await
    .unwrap()
}

async fn list(status: u16, body: serde_json::Value) -> TranslationModelListView {
    let base_url = reply_with(status, body.to_string(), false).await;
    list_translation_models_view(
        TranslationModelsRequest { api_key: "sk-probe-secret".into(), base_url, api_protocol: "openai".into() },
        runtime(),
        policy(),
        None,
    )
    .await
    .unwrap()
}

fn openai_error(code: &str, kind: &str, message: &str) -> serde_json::Value {
    json!({"error": {"message": message, "type": kind, "param": null, "code": code}})
}

fn zhipu_error(code: &str, message: &str) -> serde_json::Value {
    json!({"error": {"code": code, "message": message}})
}

// --- 校验 Key ------------------------------------------------------------------------

#[tokio::test]
async fn key_check_reports_openai_insufficient_quota_as_not_usable() {
    let body = openai_error("insufficient_quota", "insufficient_quota", "You exceeded your current quota, please check your plan and billing details.");
    let view = check_key(429, body, "openai", "gpt-5.6-luna").await;
    assert_eq!((view.ok, view.status, view.retryable), (false, "quota_exceeded", false), "{}", view.summary);
    assert_eq!((view.http_status, view.provider_code.as_deref()), (Some(429), Some("insufficient_quota")));
    assert!(view.summary.starts_with("翻译 API 不可用：") && view.summary.contains("充值"), "{}", view.summary);
    assert!(view.operator_hint.unwrap().contains("不是限流"));
}

#[tokio::test]
async fn key_check_reports_zhipu_billing_and_plan_codes() {
    let view = check_key(429, zhipu_error("1113", "余额不足或无可用资源包,请充值。"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status), (false, "insufficient_balance"), "{}", view.summary);
    assert_eq!((view.http_status, view.provider_code.as_deref()), (Some(429), Some("1113")));
    assert!(view.summary.contains("智谱") && view.summary.contains("充值"), "{}", view.summary);

    let view = check_key(429, zhipu_error("1310", "已达到每周/每月使用上限"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "quota_exceeded", Some("1310")));

    let view = check_key(429, zhipu_error("1311", "当前订阅套餐暂未开放该模型"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "unauthorized", Some("1311")));
    assert!(view.summary.contains("套餐"), "{}", view.summary);
}

#[tokio::test]
async fn key_check_keeps_real_rate_limits_usable() {
    // 没带码的 429：照旧算可用（被限流）
    let view = check_key(429, json!({"error": {"message": "Rate limit reached for requests"}}), "openai", "deepseek-flash").await;
    assert_eq!((view.ok, view.status), (true, "rate_limited"), "{}", view.summary);
    assert_eq!((view.http_status, view.provider_code.as_deref()), (Some(429), None));
    assert!(view.summary.contains("可用（当前被限流）"), "{}", view.summary);

    // 智谱 1302 并发限制、1305 过载
    let view = check_key(429, zhipu_error("1302", "您的账户已达到速率限制"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (true, "rate_limited", Some("1302")));
    let view = check_key(429, zhipu_error("1305", "该模型当前访问量过大"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (true, "rate_limited", Some("1305")));
    assert!(view.summary.contains("繁忙"), "{}", view.summary);

    // OpenAI rate_limit_exceeded
    let body = openai_error("rate_limit_exceeded", "requests", "Rate limit reached for gpt-5.6-luna");
    let view = check_key(429, body, "openai", "gpt-5.6-luna").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (true, "rate_limited", Some("rate_limit_exceeded")));
}

#[tokio::test]
async fn key_check_reads_anthropic_details_and_qwen_and_opencode() {
    let capped = json!({"type": "error", "error": {"type": "rate_limit_error", "message": "spend limit", "details": {"error_code": "enforced_spend_limit_reached"}}, "request_id": "req_1"});
    let view = check_key(429, capped, "anthropic", "claude-haiku-5-5").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "quota_exceeded", Some("enforced_spend_limit_reached")));

    // 百炼欠费是 400，以前落成「翻译 API 返回 400」
    let arrearage = openai_error("Arrearage", "Arrearage", "Access denied, please make sure your account is in good standing.");
    let view = check_key(400, arrearage, "openai", "qwen3.8-flash").await;
    assert_eq!((view.ok, view.status, view.http_status, view.provider_code.as_deref()), (false, "insufficient_balance", Some(400), Some("Arrearage")));

    // OpenCode 只有一句话
    let view = check_key_raw(429, "Upstream request failed: Policy budget exceeded".into(), "openai", "glm-5.3").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "quota_exceeded", Some("Policy budget exceeded")));
    assert!(view.summary.contains("预算"), "{}", view.summary);
}

#[tokio::test]
async fn key_check_402_401_and_bodies_without_codes() {
    let view = check_key(402, json!({"error": {"message": "Insufficient Balance"}}), "openai", "deepseek-flash").await;
    assert_eq!((view.ok, view.status, view.retryable), (false, "insufficient_balance", false), "{}", view.summary);
    assert_eq!((view.http_status, view.provider_code.as_deref()), (Some(402), None));

    let view = check_key(401, zhipu_error("1000", "身份验证失败。"), "openai", "glm-5.3-flash").await;
    assert_eq!((view.ok, view.status), (false, "unauthorized"));
    assert_eq!((view.http_status, view.provider_code.as_deref()), (Some(401), Some("1000")));

    let view = check_key(401, json!({"error": {"message": "Incorrect API key provided", "type": "invalid_request_error", "code": "invalid_api_key"}}), "openai", "gpt-5.6-luna").await;
    assert_eq!((view.status, view.provider_code.as_deref()), ("unauthorized", Some("invalid_api_key")));

    let view = check_key_raw(500, "<html>boom</html>".into(), "openai", "deepseek-flash").await;
    assert_eq!((view.status, view.http_status, view.provider_code.as_deref()), ("network_error", Some(500), None));

    let view = check_key(200, json!({"choices": [{"message": {"content": "p"}}]}), "openai", "deepseek-flash").await;
    assert_eq!((view.ok, view.http_status, view.provider_code.as_deref()), (true, Some(200), None), "成功时不再把 200 放进 provider_code");
}

#[tokio::test]
async fn key_check_without_a_model_also_reads_billing_codes() {
    let view = check_key(429, zhipu_error("1113", "余额不足"), "openai", "").await;
    assert_eq!((view.ok, view.status, view.provider_code.as_deref()), (false, "insufficient_balance", Some("1113")));
    let view = check_key(429, json!({"error": {"message": "slow down"}}), "openai", "").await;
    assert_eq!((view.status, view.http_status, view.provider_code.as_deref()), ("provider_error", Some(429), None), "只验 Key 时的普通 429 照旧");
}

// --- 问模型 ----------------------------------------------------------------------------

#[tokio::test]
async fn ask_tells_rate_limits_from_quota_and_billing() {
    let view = ask(429, openai_error("insufficient_quota", "insufficient_quota", "You exceeded your current quota")).await;
    assert_eq!((view.ok, view.status, view.http_status, view.provider_code.as_deref()), (false, "quota_exceeded", Some(429), Some("insufficient_quota")));
    assert!(view.summary.contains("重试没用"), "{}", view.summary);

    let view = ask(429, zhipu_error("1113", "余额不足")).await;
    assert_eq!((view.status, view.provider_code.as_deref()), ("insufficient_balance", Some("1113")));

    let view = ask(429, json!({"error": {"message": "Too many requests"}})).await;
    assert_eq!((view.status, view.http_status, view.provider_code.as_deref()), ("rate_limited", Some(429), None));
    assert_eq!(view.summary, "服务商限流，请稍后重试");

    let view = ask(402, json!({"error": {"message": "Insufficient Balance"}})).await;
    assert_eq!((view.status, view.provider_code.as_deref()), ("insufficient_balance", None));

    let view = ask(401, zhipu_error("1000", "身份验证失败。")).await;
    assert_eq!((view.status, view.http_status, view.provider_code.as_deref()), ("unauthorized", Some(401), Some("1000")));

    let view = ask(200, json!({"choices": [{"message": {"content": "pong"}}]})).await;
    assert_eq!((view.ok, view.http_status, view.provider_code.as_deref()), (true, Some(200), None));
}

// --- 拉模型列表 -------------------------------------------------------------------------

#[tokio::test]
async fn model_list_splits_http_status_and_business_code() {
    let view = list(429, zhipu_error("1113", "余额不足")).await;
    assert_eq!((view.ok, view.status, view.http_status, view.provider_code.as_deref()), (false, "provider_error", Some(429), Some("1113")));
    assert!(view.summary.contains("充值"), "{}", view.summary);

    let view = list(403, openai_error("Arrearage", "Arrearage", "Access denied")).await;
    assert_eq!((view.status, view.provider_code.as_deref()), ("unauthorized", Some("Arrearage")));
    assert!(view.summary.contains("欠费"), "{}", view.summary);

    let view = list(401, json!({"error": {"message": "bad key"}})).await;
    assert_eq!((view.status, view.http_status, view.provider_code.as_deref()), ("unauthorized", Some(401), None));
    assert_eq!(view.summary, "API Key 不对，或者没有列模型的权限");
}
