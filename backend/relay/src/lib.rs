//! 按页卖翻译的中转服务（2026-11-27，方案见 docs/ops/planning/translation-subscription/20261127-按页卖翻译的订阅.md）。
//!
//! 桌面版照旧在用户电脑上翻译；选了「RetainPDF 订阅」时，OCR 和模型请求走这里、用我们的 key。这里只做：认令牌、查额度、
//! 开单预扣、换上这一档配的模型和 key 转发、按实际译成的页结算。key 只在服务器环境变量里，库里只存变量名。
//! 没有管理接口：后台操作是服务器上的命令（`retainpdf-relay admin …`）。

pub mod api;
pub mod billing;
pub mod proxy;
pub mod secrets;
pub mod store;

use std::time::Duration;

use axum::extract::{DefaultBodyLimit, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::Router;

use crate::proxy::Upstream;
use crate::store::Store;

/// OCR 一次交一份 PDF（≤50MB，base64 后约 67MB），留点余量。
const MAX_BODY_BYTES: usize = 100 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub client: reqwest::Client,
    /// 客户端从外面访问这个服务的地址（开单时告诉客户端转发地址），比如 `https://relay.example.com:8443`。
    pub public_url: String,
}

impl AppState {
    pub fn new(store: Store, public_url: String) -> anyhow::Result<Self> {
        let client = reqwest::Client::builder().timeout(Duration::from_secs(900)).build()?;
        Ok(Self { store, client, public_url })
    }
}

macro_rules! relay_route {
    ($upstream:expr) => {
        post(|state: State<AppState>, headers: HeaderMap, body: axum::body::Bytes| async move {
            proxy::relay(state, $upstream, headers, body).await
        })
    };
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/v1/devices/activate", post(api::activate))
        .route("/v1/me", get(api::me))
        .route("/v1/orders", post(api::open_order))
        .route("/v1/orders/:order_id/settle", post(api::settle_order))
        .route("/v1/orders/:order_id/cancel", post(api::cancel_order))
        .route("/relay/anthropic/v1/messages", relay_route!(Upstream::AnthropicMessages))
        .route("/relay/openai/v1/chat/completions", relay_route!(Upstream::OpenAiChat))
        .route("/relay/openai/v1/responses", relay_route!(Upstream::OpenAiResponses))
        .route("/relay/glm/api/paas/v4/layout_parsing", relay_route!(Upstream::GlmOcr))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(state)
}
