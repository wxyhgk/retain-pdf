use axum::body::Body;
use axum::http::{header, HeaderMap, Method, Request};
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;
use crate::routes::common::{build_auth_route_deps, request_host_is_allowed, AuthRouteDeps};
use crate::services::accounts::{json_references, query_references, SESSION_COOKIE};
/// 路由拿「当前用户」从这里引（路由层不直接碰 services）。处理函数参数里直接写 `Principal`
/// 的提取器跟着类型放在账号包里（孤儿规则：外部类型实现外部 trait 只能写在类型所在的包）。
pub use crate::services::accounts::Principal;
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
        .map(|key| crate::config::api_key_matches(deps.api_keys, key))
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

/// 单机模式防 DNS rebinding：后端监听回环地址时，`Host` 必须是 `localhost`、IP 字面量或
/// `RUST_API_ALLOWED_HOSTS` 里的主机名，否则 403；监听非回环地址时只有配了名单才查。
/// 挂在所有路由外面（含 `/health`：就绪探测用的都是 IP 字面量）。多用户模式不查。
pub async fn reject_foreign_host(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let config = &state.config;
    if !config.accounts.mode.is_multi()
        && !request_host_is_allowed(
            &config.origin_policy,
            request.headers(),
            request.uri(),
            config.listens_on_loopback(),
        )
    {
        tracing::warn!(
            host = %request
                .headers()
                .get(header::HOST)
                .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
                .unwrap_or_default(),
            "refused request for a host that is not allowed (set RUST_API_ALLOWED_HOSTS to add one)"
        );
        return Err(AppError::forbidden("request host is not allowed"));
    }
    Ok(next.run(request).await)
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

    // 以前还认 AI 服务里 Agent 的能力令牌（X-RetainPDF-Agent-Capability），AI 服务 2026-11-03 删了。
    Err(if multi {
        AppError::unauthorized("not signed in")
    } else {
        AppError::unauthorized("missing or invalid X-API-Key")
    })
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
    // 谁能用写在接口登记表里（app/router/*.rs）。
    let policy = crate::app::endpoints::route_policy(request.method().as_str(), &template);
    state.accounts.authorize_route(&principal, policy, &template, &params)?;

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
