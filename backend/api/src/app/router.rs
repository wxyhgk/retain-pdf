use axum::middleware;
use axum::Router;
use axum::http::HeaderValue;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer, ExposeHeaders};

use crate::app::request_log::{assign_request_id, trace_layer};
use crate::app::AppState;
use crate::auth;
use crate::config::{AccountsConfig, OriginPolicyConfig};
use crate::routes::common::{method_not_allowed, request_origin_is_allowed, unknown_route};

mod accounts;
mod collections;
mod credentials;
mod documents;
mod fonts;
mod glossaries;
mod backups;
mod sync;
mod ingestion;
mod jobs;
mod model_requests;
mod providers;
mod public;

/// 登记表里的全部接口（`app/endpoints.rs`）：访问控制按它查谁能用，接口目录和接口清单快照也从这里汇总。
pub(crate) fn registered_endpoints() -> Vec<crate::app::endpoints::Endpoint> {
    let mut tables = vec![
        public::ENDPOINTS,
        accounts::ENDPOINTS,
        credentials::ENDPOINTS,
        providers::ENDPOINTS,
        ingestion::ENDPOINTS,
    ];
    tables.extend(jobs::endpoints());
    tables.extend([
        documents::ENDPOINTS,
        collections::ENDPOINTS,
        glossaries::ENDPOINTS,
        fonts::ENDPOINTS,
        sync::ENDPOINTS,
        backups::ENDPOINTS,
        model_requests::worker::ENDPOINTS,
    ]);
    tables.into_iter().flatten().copied().collect()
}

pub fn build_app(state: AppState) -> Router {
    public::routes()
        .method_not_allowed_fallback(method_not_allowed)
        .merge(authenticated_api_routes(&state))
        .merge(model_requests::worker::routes())
        .fallback(unknown_route)
        // 大的 JSON 响应压缩（见 `response_compression.rs`）；文件出口、事件流不压。
        .layer(super::response_compression::json_compression_layer())
        // 计端点使用量。挂在 CORS/Trace 之下、路由之上,这样能从 `MatchedPath`
        // 拿到路由模板而不是具体 URL。见 `route_usage`：删端点之前先量。
        .layer(middleware::from_fn(super::route_usage::record))
        .layer(middleware::from_fn_with_state(state.clone(), auth::reject_foreign_host))
        .layer(cors_layer(&state.config.accounts, &state.config.origin_policy))
        // 请求日志和请求编号（见 `request_log.rs`）；编号在日志外面，span 建出来时编号已经定了。
        .layer(trace_layer())
        .layer(middleware::from_fn(assign_request_id))
        .with_state(state)
}

/// 单机：只回给本机页面（回环地址）、和请求同主机只是端口不同的页面、`RUST_API_ALLOWED_ORIGINS`
/// 列出的来源（判断见 `OriginPolicyConfig::allows_origin`，助手终端握手也用它）；别的来源不回
/// CORS 头，但不拒（同源代理会把页面的 Origin 原样转发过来）。靠 X-API-Key 认证，不带 Cookie。
/// 多用户：认证靠 Cookie，跨域只放行配置里列出的来源并允许带凭据；没列就只能同域访问。
fn cors_layer(accounts: &AccountsConfig, origin_policy: &OriginPolicyConfig) -> CorsLayer {
    if !accounts.mode.is_multi() {
        let policy = origin_policy.clone();
        return CorsLayer::new()
            .allow_origin(AllowOrigin::predicate(move |origin: &HeaderValue, parts| {
                request_origin_is_allowed(&policy, &parts.headers, origin)
            }))
            // 来源已经收紧，方法和请求头照预检回显（X-API-Key、Content-Type、Range……）。
            .allow_methods(AllowMethods::mirror_request())
            .allow_headers(AllowHeaders::mirror_request())
            // 下载要读 Content-Disposition、Content-Range、ETag 等，和以前一样全部暴露。
            .expose_headers(ExposeHeaders::any());
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

/// 另一个端口（simple_port）上的应用：只有 `/health`、`/ready`，给健康检查用。
pub fn build_simple_app(state: AppState) -> Router {
    public::routes()
        .method_not_allowed_fallback(method_not_allowed)
        .fallback(unknown_route)
        .layer(middleware::from_fn_with_state(state.clone(), auth::reject_foreign_host))
        .layer(cors_layer(&state.config.accounts, &state.config.origin_policy))
        // 请求日志和请求编号（见 `request_log.rs`）；编号在日志外面，span 建出来时编号已经定了。
        .layer(trace_layer())
        .layer(middleware::from_fn(assign_request_id))
        .with_state(state)
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
        .merge(collections::routes())
        .merge(jobs::routes())
        .merge(providers::routes())
        .merge(fonts::routes())
        .method_not_allowed_fallback(method_not_allowed)
        // 先挂的在里层、后跑：先认证（require_api_key），再看能不能访问（enforce_access）。
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::enforce_access,
        ))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
}
