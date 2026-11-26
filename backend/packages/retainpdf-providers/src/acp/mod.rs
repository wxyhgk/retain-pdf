//! 阅读页提问的 ACP 桥（2026-11-25）：浏览器经 WebSocket 说 ACP，桥起 agent 子进程（stdio）转发。
//! 方案：docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md。
//!
//! - [`agents_view`]：`GET /ai/agents`，能用哪些 agent；
//! - [`prepare_agent`]：一次握手 → 起哪个进程、`session/new` 补什么（不行就是 HTTP 错误，不升级）；
//!   握手带了书（`job_id`，[`AskBook`]）时自带 agent 另拿到读书用的后端地址和密钥（2026-11-25，
//!   docs/ops/planning/reader-ask/20261125-自带agent读书.md）；
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
pub use registry::{AgentDistribution, AgentKind, AgentView, BUILTIN_AGENT_ID};

/// 自带 agent 的模型配置、密钥交给子进程的环境变量（Python `retainpdf_ask_agent` 读）。
pub const ASK_ENV_MODEL: &str = "RETAIN_ASK_MODEL";
pub const ASK_ENV_BASE_URL: &str = "RETAIN_ASK_BASE_URL";
pub const ASK_ENV_API_PROTOCOL: &str = "RETAIN_ASK_API_PROTOCOL";
pub const ASK_ENV_THINKING: &str = "RETAIN_ASK_THINKING";
pub const ASK_ENV_API_KEY: &str = "RETAIN_ASK_API_KEY";
/// 自带 agent 读书用（握手带了 `job_id` 才给）：读哪本书、书编号（原文页图）、后端自己的地址、读书用的密钥。
pub const ASK_ENV_JOB_ID: &str = "RETAIN_ASK_JOB_ID";
pub const ASK_ENV_DOCUMENT_ID: &str = "RETAIN_ASK_DOCUMENT_ID";
pub const ASK_ENV_BACKEND_URL: &str = "RETAIN_ASK_BACKEND_URL";
pub const ASK_ENV_BACKEND_KEY: &str = "RETAIN_ASK_BACKEND_KEY";
/// `job_id` 最长多少字节（合并阅读的虚拟任务 `merged-<64>-<16>` 是 88）。
const MAX_JOB_ID_BYTES: usize = 200;
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
    /// 本机主密钥（`RUST_API_KEYS`）：没配 AI 专用密钥时自带 agent 用它读书（见 `reading_key`）。
    pub api_keys: HashSet<String>,
    /// 后端自己的地址（回环），自带 agent 读书时回调它（[`loopback_base_url`]）。
    pub backend_url: String,
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
    /// 阅读页正在读的任务（合并阅读的虚拟任务 `merged-…` 也行）：给了，自带 agent 就能用工具读这本书。本机 agent 不看它。
    #[serde(default)]
    pub job_id: String,
}

/// 自带 agent 读的那本书：握手的 `job_id`（路由核过存在、多用户下核过归属）和它的书编号。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AskBook {
    pub job_id: String,
    pub document_id: Option<String>,
}

/// 握手里的 `job_id`：空的当没给（自带 agent 和以前一样只靠 prompt 里的上下文）；字符不对 400
/// （和条目编号一样只许字母、数字、`-_.:`，它要拼进 agent 调的地址）。
pub fn ask_job_id(query: &AcpConnectQuery) -> Result<Option<String>, AppError> {
    let job_id = query.job_id.trim();
    if job_id.is_empty() {
        return Ok(None);
    }
    let valid = job_id.len() <= MAX_JOB_ID_BYTES
        && job_id.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'));
    if !valid {
        return Err(AppError::bad_request("job_id may only contain letters, digits, '-', '_', '.' and ':'"));
    }
    Ok(Some(job_id.to_string()))
}

/// 后端自己的地址：监听 `0.0.0.0` / `::`（所有地址）时换成回环地址，IPv6 加方括号。
pub fn loopback_base_url(bind_host: &str, port: u16) -> String {
    let host = match bind_host.trim() {
        "" | "0.0.0.0" => "127.0.0.1".to_string(),
        "::" | "[::]" => "[::1]".to_string(),
        host if host.contains(':') && !host.starts_with('[') => format!("[{host}]"),
        host => host.to_string(),
    };
    format!("http://{host}:{port}")
}

/// 自带 agent 读书用哪把密钥：有 AI 专用密钥用它（只能调登记了 `agent` 的接口）；没配就用本机主密钥——
/// 密钥只进 agent 子进程的环境变量，模型看不到也挑不了地址：工具是写死的几个只读请求，书由桥定。
/// 多把时取排序后的第一把，每次一样。
fn reading_key(config: &AcpConfig) -> Option<String> {
    let first = |keys: &HashSet<String>| {
        let mut keys: Vec<&String> = keys.iter().filter(|key| !key.trim().is_empty()).collect();
        keys.sort();
        keys.first().map(|key| key.to_string())
    };
    first(&config.agent_keys).or_else(|| first(&config.api_keys))
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

fn builtin_process(
    config: &AcpConfig,
    query: &AcpConnectQuery,
    cwd: &Path,
    book: Option<&AskBook>,
) -> Result<AgentProcess, AppError> {
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
    let mut env = vec![
        (ASK_ENV_MODEL.into(), model.into()),
        (ASK_ENV_BASE_URL.into(), base_url.into()),
        (ASK_ENV_API_PROTOCOL.into(), protocol.into()),
        (ASK_ENV_THINKING.into(), query.thinking.trim().into()),
        (ASK_ENV_API_KEY.into(), credential.secret),
    ];
    if let Some(book) = book {
        match reading_key(config) {
            Some(key) => {
                env.push((ASK_ENV_JOB_ID.into(), book.job_id.clone()));
                env.push((ASK_ENV_DOCUMENT_ID.into(), book.document_id.clone().unwrap_or_default()));
                env.push((ASK_ENV_BACKEND_URL.into(), config.backend_url.clone()));
                env.push((ASK_ENV_BACKEND_KEY.into(), key));
            }
            // 没有任何密钥（不该发生：认证都过不了）就不给工具
            None => tracing::warn!("acp bridge: no key for the built-in agent to read the book; it gets no tools"),
        }
    }
    Ok(AgentProcess {
        program: PathBuf::from(&config.python_bin),
        args: vec!["-m".into(), registry::BUILTIN_AGENT_MODULE.into()],
        env,
        cwd: Some(cwd.to_path_buf()),
    })
}

/// 一次握手：起哪个进程、`session/new` 补什么。不行的在升级前就回 HTTP 错误。
/// `book` 是自带 agent 要读的书（路由按握手的 `job_id` 查好的），本机 agent 不用。
pub fn prepare_agent(
    config: &AcpConfig,
    agent_id: &str,
    headers: &HeaderMap,
    query: &AcpConnectQuery,
    book: Option<&AskBook>,
) -> Result<(AgentProcess, SessionDefaults), AppError> {
    let cwd = books_dir(&config.data_root);
    let process = if agent_id == BUILTIN_AGENT_ID {
        builtin_process(config, query, &cwd, book)?
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
        AgentProcess { program: launch.program, args: launch.args, env: launch.env, cwd: Some(cwd.clone()) }
    } else {
        return Err(AppError::not_found(format!("unknown agent {agent_id:?}")));
    };
    Ok((process, session_defaults(config, &cwd)))
}

#[cfg(test)]
mod tests;
