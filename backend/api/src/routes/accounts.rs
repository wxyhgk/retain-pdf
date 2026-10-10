//! 账号：会话状态、登录、退出、改密码（/api/v1/auth/*），以及管理员的账号管理（/api/v1/admin/users*）。
//! 单机模式下只有 /auth/session 有意义（永远是本机用户），其余返回 404。

use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::{Extension, Json};
use serde::Deserialize;
use serde_json::json;

use crate::auth::{session_cookie, SessionToken};
use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_accounts_route_deps, ok_json, ApiJson, ApiPath};
use crate::services::accounts::api::{
    account_view, admin_view, AccountUserView, AccountsService, AdminUserView, Principal, Role, SessionView,
    SESSION_COOKIE,
};
use crate::AppState;

fn require_multi(accounts: &AccountsService) -> Result<(), AppError> {
    if accounts.mode().is_multi() {
        Ok(())
    } else {
        Err(AppError::not_found("accounts are only available in multi-user mode"))
    }
}

fn require_admin(principal: &Principal) -> Result<(), AppError> {
    if principal.is_admin() {
        Ok(())
    } else {
        Err(AppError::forbidden("administrator only"))
    }
}

fn session_cookie_header(accounts: &AccountsService, token: &str, max_age_secs: i64) -> HeaderValue {
    let secure = if accounts.config().session_cookie_secure { "; Secure" } else { "" };
    HeaderValue::from_str(&format!(
        "{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age_secs}{secure}"
    ))
    .expect("session cookie is ascii")
}

/// GET /api/v1/auth/session（不需要登录）：前端据此决定要不要显示登录页。
pub async fn session_route(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<SessionView>>, AppError> {
    let accounts = build_accounts_route_deps(&state);
    let mode = accounts.mode();
    if !mode.is_multi() {
        let local = Principal::local();
        return Ok(ok_json(SessionView {
            mode: mode.as_str(),
            authenticated: true,
            user: Some(AccountUserView {
                user_id: local.user_id,
                username: local.username,
                role: Role::Admin,
                must_change_password: false,
            }),
        }));
    }
    let user = match session_cookie(&headers) {
        Some(token) => accounts.user_for_token(&token)?,
        None => None,
    };
    Ok(ok_json(SessionView { mode: mode.as_str(), authenticated: user.is_some(), user: user.as_ref().map(account_view) }))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

/// POST /api/v1/auth/login（不需要登录）。
pub async fn login_route(State(state): State<AppState>, ApiJson(input): ApiJson<LoginInput>) -> Result<Response, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    let service = accounts.clone();
    let outcome = tokio::task::spawn_blocking(move || service.login(&input.username, &input.password))
        .await
        .map_err(|_| AppError::internal("login task failed"))??;
    let mut response = Json(ApiResponse::ok(json!({ "user": account_view(&outcome.user) }))).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_cookie_header(&accounts, &outcome.token, outcome.max_age_secs));
    Ok(response)
}

/// POST /api/v1/auth/logout
pub async fn logout_route(
    State(state): State<AppState>,
    token: Option<Extension<SessionToken>>,
) -> Result<Response, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    if let Some(Extension(SessionToken(token))) = token {
        accounts.logout(&token)?;
    }
    let mut response = Json(ApiResponse::ok(json!({}))).into_response();
    response.headers_mut().insert(header::SET_COOKIE, session_cookie_header(&accounts, "", 0));
    Ok(response)
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChangePasswordInput {
    pub current_password: String,
    pub new_password: String,
}

/// POST /api/v1/auth/password：改自己的密码，其它设备的会话作废。
pub async fn change_password_route(
    State(state): State<AppState>,
    principal: Principal,
    token: Option<Extension<SessionToken>>,
    ApiJson(input): ApiJson<ChangePasswordInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    let token = token.map(|Extension(SessionToken(token))| token);
    let user = tokio::task::spawn_blocking(move || {
        accounts.change_password(&principal.user_id, &input.current_password, &input.new_password, token.as_deref())
    })
    .await
    .map_err(|_| AppError::internal("password task failed"))??;
    Ok(ok_json(json!({ "user": account_view(&user) })))
}

// ---------------------------------------------------------------- 管理员

#[derive(serde::Serialize)]
pub struct AdminUserListView {
    pub users: Vec<AdminUserView>,
}

/// GET /api/v1/admin/users
pub async fn list_users_route(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Json<ApiResponse<AdminUserListView>>, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    require_admin(&principal)?;
    Ok(ok_json(AdminUserListView { users: accounts.list_users()?.iter().map(admin_view).collect() }))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateUserInput {
    pub username: String,
    #[serde(default)]
    pub role: Option<String>,
}

/// POST /api/v1/admin/users：建账号，初始密码只在这次返回。
pub async fn create_user_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiJson(input): ApiJson<CreateUserInput>,
) -> Result<Response, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    require_admin(&principal)?;
    let role = input.role.unwrap_or_else(|| "user".into());
    let (user, initial_password) = tokio::task::spawn_blocking(move || accounts.create_user(&input.username, &role))
        .await
        .map_err(|_| AppError::internal("create user task failed"))??;
    let body = ApiResponse::ok(json!({ "user": admin_view(&user), "initial_password": initial_password }));
    Ok((StatusCode::CREATED, [(header::CACHE_CONTROL, "no-store")], Json(body)).into_response())
}

/// POST /api/v1/admin/users/:user_id/reset-password
pub async fn reset_password_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Response, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    require_admin(&principal)?;
    let initial_password = tokio::task::spawn_blocking(move || accounts.reset_password(&user_id))
        .await
        .map_err(|_| AppError::internal("reset password task failed"))??;
    let body = ApiResponse::ok(json!({ "initial_password": initial_password }));
    Ok(([(header::CACHE_CONTROL, "no-store")], Json(body)).into_response())
}

async fn set_status(state: AppState, principal: Principal, user_id: String, active: bool) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let accounts = build_accounts_route_deps(&state);
    require_multi(&accounts)?;
    require_admin(&principal)?;
    let user = accounts.set_status(&principal.user_id, &user_id, active)?;
    Ok(ok_json(json!({ "user": admin_view(&user) })))
}

/// POST /api/v1/admin/users/:user_id/disable
pub async fn disable_user_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    set_status(state, principal, user_id, false).await
}

/// POST /api/v1/admin/users/:user_id/enable
pub async fn enable_user_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    set_status(state, principal, user_id, true).await
}
