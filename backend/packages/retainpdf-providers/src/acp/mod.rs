//! 阅读页提问的 ACP 桥（2026-11-25）：浏览器经 WebSocket 说 ACP，桥起 agent 子进程（stdio）转发。
//! 方案：docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md。
//!
//! - [`agents_view`]：`GET /ai/agents`，能用哪些 agent；
//! - [`prepare_agent`]：一次握手 → 起哪个进程、`session/new` 补什么（不行就是 HTTP 错误，不升级）；
//! - [`run_bridge`]：连上以后两头转。
mod bridge;
mod gate;
mod registry;

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use axum::http::HeaderMap;
use retainpdf_api_base::error::AppError;
use serde::{Deserialize, Serialize};

pub use bridge::{run_bridge, AgentProcess, BridgeOut, SessionDefaults, CLOSE_AGENT_ENDED};
pub use registry::{AgentKind, AgentView, BUILTIN_AGENT_ID};

/// 自带 agent 的模型配置、密钥交给子进程的环境变量（Python `retainpdf_ask_agent` 读）。
pub const ASK_ENV_MODEL: &str = "RETAIN_ASK_MODEL";
pub const ASK_ENV_BASE_URL: &str = "RETAIN_ASK_BASE_URL";
pub const ASK_ENV_API_PROTOCOL: &str = "RETAIN_ASK_API_PROTOCOL";
pub const ASK_ENV_THINKING: &str = "RETAIN_ASK_THINKING";
pub const ASK_ENV_API_KEY: &str = "RETAIN_ASK_API_KEY";
const ASK_PROTOCOLS: [&str; 3] = ["openai", "openai_responses", "anthropic"];
const TRANSLATION_CREDENTIAL_KIND: &str = "translation_api_key";

/// 桥要的后端配置（由 rust_api 从 AppConfig 填）。
#[derive(Clone, Debug)]
pub struct AcpConfig {
    pub multi_user: bool,
    pub listens_on_loopback: bool,
    pub data_root: PathBuf,
    pub python_bin: String,
    pub agent_keys: HashSet<String>,
    /// `RUST_API_LOCAL_AGENTS` 的值。
    pub local_agents_flag: Option<String>,
    /// 找命令用的 PATH（测试里换成临时目录）。
    pub path_var: Option<std::ffi::OsString>,
    /// 后端自己的可执行文件（同目录找 `retainpdf` 命令行）。
    pub current_exe: Option<PathBuf>,
}

impl AcpConfig {
    fn local_reason(&self) -> String {
        gate::local_agents_reason(self.multi_user, self.listens_on_loopback, self.local_agents_flag.as_deref())
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct LocalAgentsView {
    pub enabled: bool,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct AgentsView {
    pub agents: Vec<AgentView>,
    pub local_agents: LocalAgentsView,
}

pub fn agents_view(config: &AcpConfig) -> AgentsView {
    let reason = config.local_reason();
    AgentsView {
        agents: registry::list_agents(&reason, config.path_var.as_deref()),
        local_agents: LocalAgentsView { enabled: reason.is_empty(), reason },
    }
}

/// 握手的查询参数。`api_key` 由认证那一层读，这里不用；自带 agent 的模型配置在这里。
#[derive(Clone, Debug, Default, Deserialize)]
pub struct AcpConnectQuery {
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_protocol: String,
    #[serde(default)]
    pub thinking: String,
    #[serde(default)]
    pub credential_ref: String,
}

fn books_dir(data_root: &Path) -> PathBuf {
    let books = data_root.join("books");
    if books.is_dir() { books } else { data_root.to_path_buf() }
}

fn session_defaults(config: &AcpConfig, cwd: &Path) -> SessionDefaults {
    let cli = bridge::find_retainpdf_cli(config.current_exe.as_deref(), config.path_var.as_deref());
    if cli.is_none() {
        tracing::warn!("acp bridge: retainpdf command line not found; agents get no retainpdf MCP server");
    }
    // 多把 AI 专用密钥时取排序后的第一把，每次一样
    let mut keys: Vec<&String> = config.agent_keys.iter().collect();
    keys.sort();
    SessionDefaults {
        cwd: Some(cwd.to_path_buf()),
        mcp_server: cli.map(|cli| bridge::retainpdf_mcp_server(&cli, keys.first().map(|key| key.as_str()))),
    }
}

fn builtin_process(config: &AcpConfig, query: &AcpConnectQuery, cwd: &Path) -> Result<AgentProcess, AppError> {
    let model = query.model.trim();
    if model.is_empty() || model.len() > 256 {
        return Err(AppError::bad_request("model is required for the built-in agent"));
    }
    let base_url = query.base_url.trim();
    let protocol = match query.api_protocol.trim() {
        "" => "openai",
        value => value,
    };
    if !ASK_PROTOCOLS.contains(&protocol) {
        return Err(AppError::bad_request(format!("api_protocol must be one of {}", ASK_PROTOCOLS.join(", "))));
    }
    if !base_url.is_empty() && !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err(AppError::bad_request("base_url must start with http:// or https://"));
    }
    let credential_ref = query.credential_ref.trim();
    if credential_ref.is_empty() {
        return Err(AppError::bad_request("credential_ref is required for the built-in agent"));
    }
    let credential = retainpdf_data::credentials::resolve_credential(&config.data_root, credential_ref, TRANSLATION_CREDENTIAL_KIND)
        .map_err(|error| AppError::bad_request(format!("credential_ref cannot be used: {error}")))?;
    Ok(AgentProcess {
        program: PathBuf::from(&config.python_bin),
        args: vec!["-m".into(), registry::BUILTIN_AGENT_MODULE.into()],
        env: vec![
            (ASK_ENV_MODEL.into(), model.into()),
            (ASK_ENV_BASE_URL.into(), base_url.into()),
            (ASK_ENV_API_PROTOCOL.into(), protocol.into()),
            (ASK_ENV_THINKING.into(), query.thinking.trim().into()),
            (ASK_ENV_API_KEY.into(), credential.secret),
        ],
        cwd: Some(cwd.to_path_buf()),
    })
}

/// 一次握手：起哪个进程、`session/new` 补什么。不行的在升级前就回 HTTP 错误。
pub fn prepare_agent(
    config: &AcpConfig,
    agent_id: &str,
    headers: &HeaderMap,
    query: &AcpConnectQuery,
) -> Result<(AgentProcess, SessionDefaults), AppError> {
    let cwd = books_dir(&config.data_root);
    let process = if agent_id == BUILTIN_AGENT_ID {
        builtin_process(config, query, &cwd)?
    } else if registry::is_local_agent(agent_id) {
        let reason = config.local_reason();
        if !reason.is_empty() {
            return Err(AppError::forbidden(reason));
        }
        if let Some(reason) = gate::handshake_reason(headers) {
            return Err(AppError::forbidden(reason));
        }
        let launch = registry::resolve_local_agent(agent_id, config.path_var.as_deref())
            .expect("is_local_agent checked")
            .map_err(AppError::not_found)?;
        AgentProcess { program: launch.program, args: launch.args, env: vec![], cwd: Some(cwd.clone()) }
    } else {
        return Err(AppError::not_found(format!("unknown agent {agent_id:?}")));
    };
    Ok((process, session_defaults(config, &cwd)))
}

#[cfg(test)]
mod tests;
