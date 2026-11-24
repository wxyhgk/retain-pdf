//! 密钥校验契约 `provider-probes.v1` 的生产者锁（设置类第 2 批第 3 组，2026-11-24）。
//!
//! 返回：对本机的假服务商打真实接口（单机模式放开回环地址），拿 serde 实际写出来的 JSON 核对类型和键集合；
//! 余额填一个不是 DeepSeek 官方的地址，不发请求直接回 `unsupported_provider`。不碰真服务商。
//! 请求：三个请求类型都是 `deny_unknown_fields`，契约的 `properties` 要和 Rust 认的字段一样。

use axum::http::StatusCode;
use serde_json::{json, Value};

use super::credentials_contract::assert_exact;
use super::job_view_contract::contract;
use super::library_documents_contract::assert_request_fields_match;
use super::provider_probes::{local_model_server, no_private_escape, post_single};
use super::jobs_common::test_state;
use crate::services::providers::{
    DeepSeekTokenValidationRequest, MineruTokenValidationRequest, PaddleTokenValidationRequest,
};

const CONTRACT: &str = "provider-probes.v1.schema.json";

async fn probe(state: &crate::AppState, uri: &str, body: Value) -> Value {
    let (status, payload) = post_single(state.clone(), uri, body).await;
    assert_eq!(status, StatusCode::OK, "{uri}: {payload}");
    payload["data"].clone()
}

#[tokio::test]
async fn probe_and_balance_views_match_published_schema() {
    let state = no_private_escape(test_state("provider-probes-contract"));
    let contract = contract(CONTRACT);
    // 假服务：`/v1/chat/completions` 回 200，别的地址 404（MinerU 算服务商错误，Paddle 算鉴权通过）。
    let addr = local_model_server().await;
    let base = format!("http://{addr}");

    let deepseek = probe(
        &state,
        "/api/v1/providers/deepseek/validate-token",
        json!({ "api_key": "k", "base_url": format!("{base}/v1"), "model": "m", "api_protocol": "openai" }),
    )
    .await;
    assert_exact(&deepseek, &contract, "ProviderProbeView", "deepseek");
    assert_eq!(deepseek["ok"], true, "{deepseek}");

    let mineru = probe(
        &state,
        "/api/v1/providers/mineru/validate-token",
        json!({ "mineru_token": "t", "base_url": base, "model_version": "vlm" }),
    )
    .await;
    assert_exact(&mineru, &contract, "ProviderProbeView", "mineru");

    let paddle = probe(&state, "/api/v1/providers/paddle/validate-token", json!({ "paddle_token": "t", "base_url": base })).await;
    assert_exact(&paddle, &contract, "ProviderProbeView", "paddle");

    let balance = probe(
        &state,
        "/api/v1/providers/deepseek/balance",
        json!({ "api_key": "k", "base_url": format!("{base}/v1") }),
    )
    .await;
    assert_exact(&balance, &contract, "DeepSeekBalanceView", "balance");
    assert_eq!(balance["status"], "unsupported_provider", "{balance}");
}

#[test]
fn request_bodies_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<MineruTokenValidationRequest>(&contract, "MineruTokenValidationRequest");
    assert_request_fields_match::<PaddleTokenValidationRequest>(&contract, "PaddleTokenValidationRequest");
    assert_request_fields_match::<DeepSeekTokenValidationRequest>(&contract, "DeepSeekTokenValidationRequest");
}

/// 余额有数时的样子：配置里的余额地址指向本机的假服务（`base_url` 写 DeepSeek 官方地址才会去查，不发到官方）。
#[tokio::test]
async fn balance_with_amounts_matches_published_schema() {
    let router = axum::Router::new().route(
        "/user/balance",
        axum::routing::get(|| async {
            axum::Json(json!({
                "is_available": true,
                "balance_infos": [{ "currency": "CNY", "total_balance": "1.00", "granted_balance": "0.00", "topped_up_balance": "1.00" }]
            }))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let mut state = no_private_escape(test_state("provider-probes-contract-balance"));
    let mut config = (*state.config).clone();
    config.provider_runtime.deepseek.balance_url = format!("http://{addr}/user/balance");
    state.config = std::sync::Arc::new(config);

    let contract = contract(CONTRACT);
    let balance = probe(
        &state,
        "/api/v1/providers/deepseek/balance",
        json!({ "api_key": "k", "base_url": "https://api.deepseek.com/v1" }),
    )
    .await;
    assert_exact(&balance, &contract, "DeepSeekBalanceView", "balance");
    assert_eq!(balance["status"], "available", "{balance}");
    assert_exact(&balance["balance_infos"][0], &contract, "DeepSeekBalanceInfoView", "balance.balance_infos[0]");
}
