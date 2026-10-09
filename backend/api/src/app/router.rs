use axum::middleware;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::app::AppState;
use crate::auth;
use crate::routes::common::{method_not_allowed, unknown_route};

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
    public::routes()
        .merge(authenticated_api_routes(&state))
        .merge(self_authenticating_websocket_routes())
        .merge(crate::routes::model_requests::worker_routes())
        .fallback(unknown_route)
        // 计端点使用量。挂在 CORS/Trace 之下、路由之上,这样能从 `MatchedPath`
        // 拿到路由模板而不是具体 URL。见 `route_usage`：删端点之前先量。
        .layer(middleware::from_fn(super::route_usage::record))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub fn build_simple_app(state: AppState) -> Router {
    public::routes()
        .merge(authenticated_simple_routes(&state))
        .fallback(unknown_route)
        .layer(CorsLayer::permissive())
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
