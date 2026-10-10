//! 账号与部署模式。
//!
//! - `single`（默认）：单机版，没有登录；所有请求都是固定的「本机用户」（管理员），行为与以前一样。
//! - `multi`：我们运营的网站。不开放注册，管理员建账号、给用户名和密码；浏览器靠会话 Cookie 认证，
//!   `X-API-Key` 只留给内部服务（任务执行、AI 服务、命令行）。

use anyhow::{bail, Result};

use super::env_vars::env_optional_string;

/// 单机模式下那个固定的本机用户。
pub const LOCAL_USER_ID: &str = "local";
pub const LOCAL_USERNAME: &str = "local";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum DeploymentMode {
    #[default]
    Single,
    Multi,
}

impl DeploymentMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Single => "single",
            Self::Multi => "multi",
        }
    }

    pub fn is_multi(self) -> bool {
        matches!(self, Self::Multi)
    }
}

#[derive(Clone, Debug)]
pub struct AccountsConfig {
    pub mode: DeploymentMode,
    /// multi 模式下允许跨域（带凭据）的来源，例如 `https://app.example.com`。同域部署可以留空。
    pub allowed_origins: Vec<String>,
    /// 会话 Cookie 是否只走 HTTPS。正式部署必须开；本机开发（http）可以关。
    pub session_cookie_secure: bool,
    pub session_ttl_days: u32,
    /// 启动时没有任何管理员就用它建第一个（部署时从环境变量给，不写进代码和日志）。
    pub bootstrap_admin: Option<(String, String)>,
    /// multi 模式下所有任务统一用的模型和 OCR（平台出钱）；客户端传来的一律不认。
    pub platform: PlatformModels,
}

/// 平台的模型与 OCR 设置。密钥不放这里：管理员先经凭据接口存好，这里只写凭据编号。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PlatformModels {
    pub translation_model: String,
    pub translation_base_url: String,
    /// 空 = 默认协议。
    pub translation_api_protocol: String,
    pub translation_credential_ref: String,
    pub ocr_provider: String,
    pub ocr_credential_ref: String,
}

impl PlatformModels {
    pub fn from_env() -> Self {
        let read = |name: &str| env_optional_string(name).map(|value| value.trim().to_string()).unwrap_or_default();
        Self {
            translation_model: read("RETAIN_PLATFORM_TRANSLATION_MODEL"),
            translation_base_url: read("RETAIN_PLATFORM_TRANSLATION_BASE_URL"),
            translation_api_protocol: read("RETAIN_PLATFORM_TRANSLATION_API_PROTOCOL"),
            translation_credential_ref: read("RETAIN_PLATFORM_TRANSLATION_CREDENTIAL_REF"),
            ocr_provider: read("RETAIN_PLATFORM_OCR_PROVIDER"),
            ocr_credential_ref: read("RETAIN_PLATFORM_OCR_CREDENTIAL_REF"),
        }
    }

    pub fn translation_ready(&self) -> bool {
        ![&self.translation_model, &self.translation_base_url, &self.translation_credential_ref]
            .iter()
            .any(|value| value.is_empty())
    }

    pub fn ocr_ready(&self) -> bool {
        !self.ocr_provider.is_empty() && !self.ocr_credential_ref.is_empty()
    }
}

impl Default for AccountsConfig {
    fn default() -> Self {
        Self {
            mode: DeploymentMode::Single,
            allowed_origins: Vec::new(),
            session_cookie_secure: true,
            session_ttl_days: 30,
            bootstrap_admin: None,
            platform: PlatformModels::default(),
        }
    }
}

impl AccountsConfig {
    pub fn from_env() -> Result<Self> {
        let mode = match env_optional_string("RETAIN_DEPLOYMENT_MODE").as_deref().map(str::trim) {
            None | Some("") | Some("single") => DeploymentMode::Single,
            Some("multi") => DeploymentMode::Multi,
            Some(other) => bail!("RETAIN_DEPLOYMENT_MODE must be `single` or `multi`, got `{other}`"),
        };
        let allowed_origins = env_optional_string("RETAIN_ALLOWED_ORIGINS")
            .map(|raw| {
                raw.split(',')
                    .map(|origin| origin.trim().trim_end_matches('/').to_string())
                    .filter(|origin| !origin.is_empty())
                    .collect()
            })
            .unwrap_or_default();
        let session_cookie_secure = !matches!(
            env_optional_string("RETAIN_SESSION_COOKIE_SECURE").as_deref().map(str::trim),
            Some("0" | "false" | "no")
        );
        let session_ttl_days = match env_optional_string("RETAIN_SESSION_TTL_DAYS") {
            Some(raw) => match raw.trim().parse::<u32>() {
                Ok(days) if (1..=365).contains(&days) => days,
                _ => bail!("RETAIN_SESSION_TTL_DAYS must be 1..=365"),
            },
            None => 30,
        };
        let bootstrap_admin = match (
            env_optional_string("RETAIN_BOOTSTRAP_ADMIN_USERNAME"),
            env_optional_string("RETAIN_BOOTSTRAP_ADMIN_PASSWORD"),
        ) {
            (Some(username), Some(password)) if !username.trim().is_empty() && !password.is_empty() => {
                Some((username.trim().to_string(), password))
            }
            (None, None) => None,
            _ => bail!("RETAIN_BOOTSTRAP_ADMIN_USERNAME and RETAIN_BOOTSTRAP_ADMIN_PASSWORD must be set together"),
        };
        Ok(Self {
            mode,
            allowed_origins,
            session_cookie_secure,
            session_ttl_days,
            bootstrap_admin,
            platform: PlatformModels::from_env(),
        })
    }
}
