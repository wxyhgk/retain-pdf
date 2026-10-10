//! 账号、登录、会话（多用户模式）。
//!
//! 不开放注册：管理员建账号，系统生成初始密码交给用户；用户名 + 密码登录，浏览器拿一个只有服务器能读
//! 的会话 Cookie。密码存 Argon2id 哈希；会话令牌只存 sha256。单机模式下没有这些，所有请求都是固定的
//! 本机用户（见 [`Principal::local`]）。

use std::sync::Arc;

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::http::StatusCode;
use base64::Engine;
use chrono::{Duration, SecondsFormat, Utc};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::config::{AccountsConfig, DeploymentMode, LOCAL_USERNAME, LOCAL_USER_ID};
use crate::db::{Db, OwnedKind, UserRecord, UsernameTaken};
use crate::error::AppError;

pub(crate) mod access;
pub(crate) mod api;

pub const SESSION_COOKIE: &str = "retain_session";
const LOCK_AFTER_FAILURES: i64 = 5;
const LOCK_MINUTES: i64 = 15;
const MIN_PASSWORD_CHARS: usize = 8;
const MAX_PASSWORD_CHARS: usize = 128;
/// 初始密码的字符：去掉容易看错的 0/O、1/l/I。
const PASSWORD_ALPHABET: &[u8] = b"abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------- 当前用户

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Admin,
    User,
}

/// 这个请求是谁发的、怎么认证的。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthVia {
    /// 单机模式：没有登录，固定的本机用户。
    Local,
    /// 浏览器会话。
    Session,
    /// 内部服务（任务执行、AI 服务、命令行）的 X-API-Key。
    ServiceKey,
    /// 助手的临时授权。
    Capability,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Principal {
    pub user_id: String,
    pub username: String,
    pub role: Role,
    pub via: AuthVia,
}

impl Principal {
    pub fn local() -> Self {
        Self { user_id: LOCAL_USER_ID.into(), username: LOCAL_USERNAME.into(), role: Role::Admin, via: AuthVia::Local }
    }

    pub fn service() -> Self {
        Self { user_id: "service".into(), username: "service".into(), role: Role::Admin, via: AuthVia::ServiceKey }
    }

    pub fn from_user(user: &UserRecord) -> Self {
        Self {
            user_id: user.user_id.clone(),
            username: user.username.clone(),
            role: if user.role == "admin" { Role::Admin } else { Role::User },
            via: AuthVia::Session,
        }
    }

    pub fn is_admin(&self) -> bool {
        self.role == Role::Admin
    }

    /// 列表要不要按归属过滤：只有网站账号（浏览器会话）要；单机、内部服务看全部。
    pub fn owner_filter(&self) -> Option<&str> {
        (self.via == AuthVia::Session).then_some(self.user_id.as_str())
    }

    /// 新建的数据记在谁名下：网站账号记自己；其余记本机用户（多用户模式下网站账号看不见）。
    pub fn owner_id(&self) -> &str {
        match self.via {
            AuthVia::Session => &self.user_id,
            _ => LOCAL_USER_ID,
        }
    }

    /// 上传文件的「指纹」也是书的编号。多用户模式下按账号区分：两个人传同一份 PDF 是两本书，
    /// 互不可见，也不会共用 OCR 结果。单机模式就是文件字节的 sha256，和以前一样。
    pub fn scoped_content_hash(&self, plain_sha256: &str) -> String {
        match self.via {
            AuthVia::Session => {
                Sha256::digest(format!("{}:{plain_sha256}", self.user_id).as_bytes())
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect()
            }
            _ => plain_sha256.to_string(),
        }
    }
}

fn not_found_for(kind: OwnedKind, id: &str) -> AppError {
    let label = match kind {
        OwnedKind::Upload => "upload",
        OwnedKind::Job => "job",
        OwnedKind::Document => "document",
        OwnedKind::Glossary => "glossary",
        OwnedKind::Collection => "collection",
    };
    AppError::not_found(format!("{label} not found: {id}"))
}

// ---------------------------------------------------------------- 视图

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct AccountUserView {
    pub user_id: String,
    pub username: String,
    pub role: Role,
    pub must_change_password: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct AdminUserView {
    pub user_id: String,
    pub username: String,
    pub role: Role,
    pub status: String,
    pub must_change_password: bool,
    pub created_at: String,
    pub last_login_at: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct SessionView {
    pub mode: &'static str,
    pub authenticated: bool,
    pub user: Option<AccountUserView>,
}

fn role_of(user: &UserRecord) -> Role {
    if user.role == "admin" { Role::Admin } else { Role::User }
}

pub fn account_view(user: &UserRecord) -> AccountUserView {
    AccountUserView {
        user_id: user.user_id.clone(),
        username: user.username.clone(),
        role: role_of(user),
        must_change_password: user.must_change_password,
    }
}

pub fn admin_view(user: &UserRecord) -> AdminUserView {
    AdminUserView {
        user_id: user.user_id.clone(),
        username: user.username.clone(),
        role: role_of(user),
        status: user.status.clone(),
        must_change_password: user.must_change_password,
        created_at: user.created_at.clone(),
        last_login_at: user.last_login_at.clone(),
    }
}

// ---------------------------------------------------------------- 密码、令牌

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AppError::internal("password hashing failed"))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
        .unwrap_or(false)
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    getrandom::getrandom(&mut bytes).expect("os random source");
    bytes
}

pub fn generate_initial_password() -> String {
    random_bytes::<14>()
        .iter()
        .map(|byte| PASSWORD_ALPHABET[*byte as usize % PASSWORD_ALPHABET.len()] as char)
        .collect()
}

fn new_session_token() -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random_bytes::<32>())
}

pub fn session_token_hash(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn new_user_id() -> String {
    format!("u_{}", random_bytes::<9>().iter().map(|byte| format!("{byte:02x}")).collect::<String>())
}

pub fn validate_username(username: &str) -> Result<(), AppError> {
    let username = username.trim();
    let ok = (3..=32).contains(&username.chars().count())
        && username.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
        && username != LOCAL_USER_ID
        && username != "service";
    if ok {
        Ok(())
    } else {
        Err(AppError::account(
            StatusCode::BAD_REQUEST,
            "INVALID_USERNAME",
            "用户名要 3～32 位，只能用字母、数字、点、下划线、连字符",
            json!({}),
        ))
    }
}

pub fn validate_new_password(password: &str) -> Result<(), AppError> {
    let count = password.chars().count();
    if (MIN_PASSWORD_CHARS..=MAX_PASSWORD_CHARS).contains(&count) {
        Ok(())
    } else {
        Err(AppError::account(
            StatusCode::BAD_REQUEST,
            "WEAK_PASSWORD",
            format!("密码要 {MIN_PASSWORD_CHARS}～{MAX_PASSWORD_CHARS} 位"),
            json!({ "min_length": MIN_PASSWORD_CHARS }),
        ))
    }
}

fn invalid_credentials() -> AppError {
    AppError::account(StatusCode::UNAUTHORIZED, "INVALID_CREDENTIALS", "用户名或密码不对", json!({}))
}

fn db_error(error: anyhow::Error) -> AppError {
    AppError::internal(format!("account storage failed: {error:#}"))
}

// ---------------------------------------------------------------- 服务

#[derive(Clone)]
pub struct AccountsService {
    db: Arc<Db>,
    config: AccountsConfig,
}

/// 登录成功：账号和要写进 Cookie 的令牌（明文只在这里出现一次）。
pub struct LoginOutcome {
    pub user: UserRecord,
    pub token: String,
    pub max_age_secs: i64,
}

impl AccountsService {
    pub fn new(db: Arc<Db>, config: AccountsConfig) -> Self {
        Self { db, config }
    }

    pub fn mode(&self) -> DeploymentMode {
        self.config.mode
    }

    pub fn config(&self) -> &AccountsConfig {
        &self.config
    }

    /// 资源是不是这个人的。单机 / 内部服务一律放行；网站账号只认自己的（不存在和别人的都回 404）。
    pub fn require_owned(&self, principal: &Principal, kind: OwnedKind, id: &str) -> Result<(), AppError> {
        let Some(owner) = principal.owner_filter() else {
            return Ok(());
        };
        // 合并阅读的「任务」编号由书的编号拼成，库里没有这一行：按那本书核。
        if kind == OwnedKind::Job {
            if let Some(merged) = crate::storage_paths::MergedJobId::parse(id) {
                return self.require_owned(principal, OwnedKind::Document, &merged.document_id);
            }
        }
        match self.db.resource_owner(kind, id).map_err(db_error)? {
            Some(actual) if actual == owner => Ok(()),
            _ => Err(not_found_for(kind, id)),
        }
    }

    /// 一个请求能不能过：路由策略 + 路径里每个有归属的编号。
    pub fn authorize_route(
        &self,
        principal: &Principal,
        method: &str,
        template: &str,
        params: &[(String, String)],
    ) -> Result<(), AppError> {
        if principal.owner_filter().is_none() {
            return Ok(());
        }
        match access::route_policy(method, template) {
            access::RoutePolicy::Closed => return Err(AppError::not_found(format!("route not found: {template}"))),
            access::RoutePolicy::AdminOnly if !principal.is_admin() => {
                return Err(AppError::forbidden("administrator only"))
            }
            _ => {}
        }
        for (name, value) in params {
            match access::classify_param(name) {
                access::ParamClass::Owned(kind) => self.require_owned(principal, kind, value)?,
                access::ParamClass::Nested => {}
                access::ParamClass::Unknown => {
                    return Err(AppError::forbidden(format!("path parameter `{name}` is not cleared for accounts")))
                }
            }
        }
        Ok(())
    }

    /// 多用户模式启动时：还没有管理员、又配了初始管理员，就建一个。
    pub fn bootstrap_admin(&self) -> Result<Option<String>, AppError> {
        if !self.config.mode.is_multi() {
            return Ok(None);
        }
        let Some((username, password)) = self.config.bootstrap_admin.clone() else {
            return Ok(None);
        };
        if self.db.count_active_admins().map_err(db_error)? > 0 {
            return Ok(None);
        }
        validate_username(&username)?;
        validate_new_password(&password)?;
        let user = self
            .db
            .create_user(&new_user_id(), &username, &hash_password(&password)?, "admin", false, &now())
            .map_err(db_error)?;
        Ok(Some(user.username))
    }

    /// 令牌对应的账号（过期、停用的不算）。
    pub fn user_for_token(&self, token: &str) -> Result<Option<UserRecord>, AppError> {
        self.db.session_user(&session_token_hash(token), &now()).map_err(db_error)
    }

    pub fn login(&self, username: &str, password: &str) -> Result<LoginOutcome, AppError> {
        let found = self.db.user_for_login(username).map_err(db_error)?;
        let Some((user, hash)) = found else {
            // 用户不存在时也算一次哈希，别让响应时间泄露「有没有这个账号」。
            static DUMMY_HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();
            let dummy = DUMMY_HASH.get_or_init(|| hash_password(&generate_initial_password()).unwrap_or_default());
            let _ = verify_password(password, dummy);
            return Err(invalid_credentials());
        };
        let now_at = now();
        if !user.locked_until.is_empty() && user.locked_until.as_str() > now_at.as_str() {
            let retry_after = chrono::DateTime::parse_from_rfc3339(&user.locked_until)
                .map(|until| (until.with_timezone(&Utc) - Utc::now()).num_seconds().max(1))
                .unwrap_or(LOCK_MINUTES * 60);
            return Err(AppError::account(
                StatusCode::TOO_MANY_REQUESTS,
                "TOO_MANY_ATTEMPTS",
                "密码错误次数太多，稍后再试",
                json!({ "retry_after_secs": retry_after }),
            ));
        }
        if !verify_password(password, &hash) {
            let lock_until = (Utc::now() + Duration::minutes(LOCK_MINUTES)).to_rfc3339_opts(SecondsFormat::Secs, true);
            self.db
                .record_login_failure(&user.user_id, LOCK_AFTER_FAILURES, &lock_until, &now_at)
                .map_err(db_error)?;
            return Err(invalid_credentials());
        }
        if user.status != "active" {
            return Err(AppError::account(StatusCode::FORBIDDEN, "ACCOUNT_DISABLED", "账号已停用，请联系管理员", json!({})));
        }
        self.db.record_login_success(&user.user_id, &now_at).map_err(db_error)?;
        let token = new_session_token();
        let max_age_secs = i64::from(self.config.session_ttl_days) * 86_400;
        let expires_at = (Utc::now() + Duration::seconds(max_age_secs)).to_rfc3339_opts(SecondsFormat::Secs, true);
        self.db
            .create_session(&session_token_hash(&token), &user.user_id, &now_at, &expires_at)
            .map_err(db_error)?;
        let _ = self.db.purge_expired_sessions(&now_at);
        let user = self.db.get_user(&user.user_id).map_err(db_error)?.unwrap_or(user);
        Ok(LoginOutcome { user, token, max_age_secs })
    }

    pub fn logout(&self, token: &str) -> Result<(), AppError> {
        self.db.delete_session(&session_token_hash(token)).map_err(db_error)
    }

    /// 改自己的密码：成功后其它设备的会话作废，当前这个保留。
    pub fn change_password(
        &self,
        user_id: &str,
        current_password: &str,
        new_password: &str,
        current_token: Option<&str>,
    ) -> Result<UserRecord, AppError> {
        let hash = self.db.password_hash(user_id).map_err(db_error)?.ok_or_else(invalid_credentials)?;
        if !verify_password(current_password, &hash) {
            // 不用 401：前端把 401 当成「会话失效，回登录页」。
            return Err(AppError::account(StatusCode::BAD_REQUEST, "WRONG_PASSWORD", "当前密码不对", json!({})));
        }
        validate_new_password(new_password)?;
        if new_password == current_password {
            return Err(AppError::account(StatusCode::BAD_REQUEST, "SAME_PASSWORD", "新密码不能和当前密码一样", json!({})));
        }
        self.db.set_user_password(user_id, &hash_password(new_password)?, false, &now()).map_err(db_error)?;
        let keep = current_token.map(session_token_hash);
        self.db.delete_user_sessions(user_id, keep.as_deref()).map_err(db_error)?;
        self.require_user(user_id)
    }

    fn require_user(&self, user_id: &str) -> Result<UserRecord, AppError> {
        self.db
            .get_user(user_id)
            .map_err(db_error)?
            .ok_or_else(|| AppError::not_found(format!("user not found: {user_id}")))
    }

    // ------------------------------------------------------------ 管理员

    pub fn list_users(&self) -> Result<Vec<UserRecord>, AppError> {
        self.db.list_users().map_err(db_error)
    }

    pub fn create_user(&self, username: &str, role: &str) -> Result<(UserRecord, String), AppError> {
        validate_username(username)?;
        if !matches!(role, "admin" | "user") {
            return Err(AppError::bad_request("role must be admin or user"));
        }
        let initial = generate_initial_password();
        match self.db.create_user(&new_user_id(), username, &hash_password(&initial)?, role, true, &now()) {
            Ok(user) => Ok((user, initial)),
            Err(error) if error.downcast_ref::<UsernameTaken>().is_some() => Err(AppError::account(
                StatusCode::CONFLICT,
                "USERNAME_TAKEN",
                "这个用户名已经有人用了",
                json!({}),
            )),
            Err(error) => Err(db_error(error)),
        }
    }

    /// 重置密码：生成新的初始密码，作废全部会话，要求登录后改密码。
    pub fn reset_password(&self, user_id: &str) -> Result<String, AppError> {
        self.require_user(user_id)?;
        let initial = generate_initial_password();
        self.db.set_user_password(user_id, &hash_password(&initial)?, true, &now()).map_err(db_error)?;
        self.db.delete_user_sessions(user_id, None).map_err(db_error)?;
        Ok(initial)
    }

    pub fn set_status(&self, acting_user_id: &str, user_id: &str, active: bool) -> Result<UserRecord, AppError> {
        let user = self.require_user(user_id)?;
        if !active {
            if user_id == acting_user_id {
                return Err(AppError::bad_request("不能停用自己的账号"));
            }
            if user.role == "admin" && user.status == "active" && self.db.count_active_admins().map_err(db_error)? <= 1 {
                return Err(AppError::bad_request("至少要保留一个可用的管理员"));
            }
        }
        self.db
            .set_user_status(user_id, if active { "active" } else { "disabled" }, &now())
            .map_err(db_error)?;
        if !active {
            self.db.delete_user_sessions(user_id, None).map_err(db_error)?;
        }
        self.require_user(user_id)
    }
}

#[cfg(test)]
mod tests;
