use axum::middleware;
use axum::Router;
use axum::http::HeaderValue;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::app::AppState;
use crate::auth;
use crate::config::AccountsConfig;
use crate::routes::common::{method_not_allowed, unknown_route};

mod accounts;
mod ai;
mod collections;
mod credentials;
mod documents;
mod fonts;
mod glossaries;
mod backups;
mod sync;
mod ingestion;
mod internal_agent;
mod jobs;
mod library;
mod providers;
mod public;
mod simple;

pub fn build_app(state: AppState) -> Router {
    // 多用户模式下没有终端：助手终端能在服务器上执行命令，只给单机版。
    let websocket_routes = if state.config.accounts.mode.is_multi() {
        Router::new()
    } else {
        self_authenticating_websocket_routes()
    };
    public::routes()
        .merge(authenticated_api_routes(&state))
        .merge(websocket_routes)
        .merge(crate::routes::model_requests::worker_routes())
        .fallback(unknown_route)
        // 计端点使用量。挂在 CORS/Trace 之下、路由之上,这样能从 `MatchedPath`
        // 拿到路由模板而不是具体 URL。见 `route_usage`：删端点之前先量。
        .layer(middleware::from_fn(super::route_usage::record))
        .layer(cors_layer(&state.config.accounts))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// 单机：任何来源都可以（本机页面、桌面壳、命令行），靠 X-API-Key 认证，不带 Cookie。
/// 多用户：认证靠 Cookie，跨域只放行配置里列出的来源并允许带凭据；没列就只能同域访问。
fn cors_layer(accounts: &AccountsConfig) -> CorsLayer {
    if !accounts.mode.is_multi() {
        return CorsLayer::permissive();
    }
    let origins: Vec<HeaderValue> = accounts
        .allowed_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();
    if origins.is_empty() {
        return CorsLayer::new();
    }
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods(AllowMethods::mirror_request())
        .allow_headers(AllowHeaders::mirror_request())
}

pub fn build_simple_app(state: AppState) -> Router {
    public::routes()
        .merge(authenticated_simple_routes(&state))
        .fallback(unknown_route)
        .layer(cors_layer(&state.config.accounts))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// 自己做鉴权的 WebSocket 路由。
///
/// **不能**挂 require_api_key：那道中间件只读 `x-api-key` 请求头，而浏览器的
/// WebSocket 构造函数设不了请求头（W3C 规范的限制）。所以这些 handler 自己
/// 校验，并额外接受查询参数里的 key。
///
/// 只有真正需要的路由放这里 —— 放宽全局鉴权会把 key 写进每一条访问日志。
fn self_authenticating_websocket_routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/ai/terminal",
        axum::routing::get(crate::routes::ai_terminal::terminal_proxy),
    )
}

fn authenticated_api_routes(state: &AppState) -> Router<AppState> {
    Router::new()
        .merge(accounts::routes())
        .merge(credentials::routes())
        .merge(ingestion::routes())
        .merge(glossaries::routes())
        .merge(sync::routes())
        .merge(backups::routes())
        .merge(documents::routes())
        .merge(ai::routes())
        .merge(collections::routes())
        .merge(internal_agent::routes())
        .merge(library::routes())
        .merge(jobs::routes())
        .merge(providers::routes())
        .merge(fonts::routes())
        .merge(crate::routes::model_requests::launcher_routes())
        .method_not_allowed_fallback(method_not_allowed)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
}

fn authenticated_simple_routes(state: &AppState) -> Router<AppState> {
    simple::routes()
        .method_not_allowed_fallback(method_not_allowed)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
}
