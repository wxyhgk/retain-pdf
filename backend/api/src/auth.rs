use axum::body::Body;
use axum::http::{header, HeaderMap, Method, Request};
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;
use crate::routes::common::{build_auth_route_deps, AuthRouteDeps};
use crate::services::accounts::api::{json_references, query_references, SESSION_COOKIE};
/// 路由拿「当前用户」从这里引（路由层不直接碰 services）。
pub use crate::services::accounts::api::Principal;
use crate::AppState;

/// 会话 Cookie 里的令牌，放进请求扩展里，退出、改密码时要用。
#[derive(Clone, Debug)]
pub struct SessionToken(pub String);

fn has_valid_api_key(deps: AuthRouteDeps<'_>, request: &Request<Body>) -> bool {
    request
        .headers()
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|key| deps.api_keys.contains(key))
        .unwrap_or(false)
}

/// 从 Cookie 请求头里取会话令牌。
pub fn session_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == SESSION_COOKIE)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// 靠 Cookie 认证的写请求必须来自我们自己的页面：Origin 要么在允许列表里，要么和 Host 同源。
/// 浏览器跨站发 POST 一定带 Origin；没有 Origin 的（同源导航、命令行）放行，SameSite=Lax 兜底。
fn check_origin(state: &AppState, request: &Request<Body>) -> Result<(), AppError> {
    if matches!(*request.method(), Method::GET | Method::HEAD | Method::OPTIONS) {
        return Ok(());
    }
    let Some(origin) = request.headers().get(header::ORIGIN).and_then(|value| value.to_str().ok()) else {
        return Ok(());
    };
    let origin = origin.trim_end_matches('/');
    let allowed = &state.config.accounts.allowed_origins;
    let same_host = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|host| origin.split_once("://").is_some_and(|(_, rest)| rest == host));
    if same_host || allowed.iter().any(|item| item == origin) {
        Ok(())
    } else {
        Err(AppError::forbidden("request origin is not allowed"))
    }
}

pub async fn require_api_key(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    if request.method() == Method::OPTIONS {
        return Ok(next.run(request).await);
    }
    let multi = state.config.accounts.mode.is_multi();

    if has_valid_api_key(build_auth_route_deps(&state), &request) {
        // 单机：钥匙就是本机用户；多用户：钥匙只给内部服务。
        let principal = if multi { Principal::service() } else { Principal::local() };
        request.extensions_mut().insert(principal);
        return Ok(next.run(request).await);
    }

    if multi {
        if let Some(token) = session_cookie(request.headers()) {
            if let Some(user) = state.accounts.user_for_token(&token)? {
                check_origin(&state, &request)?;
                request.extensions_mut().insert(Principal::from_user(&user));
                request.extensions_mut().insert(SessionToken(token));
                return Ok(next.run(request).await);
            }
        }
    }

    let capability = request
        .headers()
        .get("x-retainpdf-agent-capability")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            if multi {
                AppError::unauthorized("not signed in")
            } else {
                AppError::unauthorized("missing or invalid X-API-Key")
            }
        })?;
    let claims = state.agent_capabilities.authenticate_request(
        capability,
        request.method().as_str(),
        request.uri().path(),
    )?;
    request.extensions_mut().insert(claims);
    let mut principal = if multi { Principal::service() } else { Principal::local() };
    principal.via = crate::services::accounts::api::AuthVia::Capability;
    request.extensions_mut().insert(principal);
    Ok(next.run(request).await)
}

/// 认证之后的第二道：多用户模式下网站账号能不能走这条路由；路径、查询串、JSON 请求体里出现的
/// 上传 / 任务 / 书 / 术语表 / 文件夹编号是不是自己的。单机模式、内部服务直接放行。
/// 挂在 require_api_key 里层（route_layer 后挂的先跑，所以它要先挂）。
pub async fn enforce_access(
    axum::extract::State(state): axum::extract::State<AppState>,
    matched: Option<axum::extract::MatchedPath>,
    params: axum::extract::RawPathParams,
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let principal = match request.extensions().get::<Principal>() {
        Some(principal) if principal.owner_filter().is_some() => principal.clone(),
        _ => return Ok(next.run(request).await),
    };
    let Some(template) = matched.as_ref().map(|matched| matched.as_str().to_string()) else {
        return Ok(next.run(request).await);
    };
    let params: Vec<(String, String)> =
        params.iter().map(|(name, value)| (name.to_string(), value.to_string())).collect();
    state
        .accounts
        .authorize_route(&principal, request.method().as_str(), &template, &params)?;

    let mut references = query_references(&template, request.uri().query().unwrap_or(""));
    let is_json = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.trim_start().to_ascii_lowercase().starts_with("application/json"));
    let request = if is_json {
        let (parts, body) = request.into_parts();
        let bytes = axum::body::to_bytes(body, ACCESS_JSON_BODY_LIMIT)
            .await
            .map_err(|_| AppError::payload_too_large("request body too large"))?;
        if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
            references.extend(json_references(&template, &value));
        }
        Request::from_parts(parts, Body::from(bytes))
    } else {
        request
    };
    for (kind, id) in references {
        state.accounts.require_owned(&principal, kind, &id)?;
    }
    Ok(next.run(request).await)
}

/// 网站账号的 JSON 请求体要先读进来核对编号；比这大的不是正常请求。
const ACCESS_JSON_BODY_LIMIT: usize = 16 * 1024 * 1024;

/// 在处理函数里直接拿「当前用户」：认证中间件已经放进请求扩展里了；没有就是没登录。
#[axum::async_trait]
impl<S: Send + Sync> axum::extract::FromRequestParts<S> for Principal {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut axum::http::request::Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Principal>()
            .cloned()
            .ok_or_else(|| AppError::unauthorized("not signed in"))
    }
}
