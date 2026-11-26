//! 阅读页提问的 ACP 桥（2026-11-25）：浏览器经 WebSocket 说 ACP，桥起 agent 子进程（stdio）转发。
//! 方案：docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md。
//!
//! - [`agents_view`]：`GET /ai/agents`，能用哪些 agent；
//! - [`prepare_agent`]：一次握手 → 起哪个进程、`session/new` 补什么（不行就是 HTTP 错误，不升级）；
//!   握手带了书（`job_id`，[`AskBook`]）时自带 agent 另拿到读书用的后端地址和密钥（2026-11-25，
//!   docs/ops/planning/reader-ask/20261125-自带agent读书.md）；
//! - [`run_bridge`]：连上以后两头转；
//! - [`install_agent`]、[`spawn_default_installs`]：把本机 agent 装进后端自己的安装目录（2026-11-26，
//!   docs/ops/planning/reader-ask/20261126-本机agent默认安装.md）。
//!
//! 回答里的互动块（OpenUI，2026-11-26，[`openui`]）：三类 agent 都拿到说明文件和检查器的位置——自带的两个在进程环境里，
//! 本机 agent 在补进 `session/new` 的 `retainpdf mcp` 的 `env` 里；方案 docs/ops/planning/reader-ask/20261126-互动块后端实现.md。
//!
//! 自带的有两个（2026-11-26）：`retainpdf`（Python `retainpdf_ask_agent`）和 `retainpdf-pi`（pi-acp + pi + 我们的扩展，
//! 见 [`pi`]，方案 docs/ops/planning/reader-ask/20261126-RetainPDF加pi.md）。两个都用设置里的模型，握手参数一样。
mod bridge;
mod gate;
mod install;
mod openui;
mod pi;
mod registry;

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use axum::http::HeaderMap;
use retainpdf_api_base::error::AppError;
use serde::{Deserialize, Serialize};

pub use bridge::{run_bridge, AgentProcess, BridgeOut, SessionDefaults, CLOSE_AGENT_ENDED};
pub use install::{AgentInstallView, InstallMethod, InstallState, AGENTS_DIR_NAME, DEFAULT_INSTALL_ENV, NODE_DIR_ENV};
pub use openui::{default_openui_check_dir, default_openui_dir, NODE_BIN_ENV, OPENUI_CHECK_DIR_ENV, OPENUI_DIR_ENV};
pub use pi::PI_AGENT_ID;
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
    /// 仓库的 `backend/` 目录（`retainpdf-pi` 在这里找 `pi-agent/` 和自带 agent 的提示词）；没有就列成不能用。
    pub backend_root: Option<PathBuf>,
    /// 后端自己管的本机 agent 安装目录（`<数据目录>/acp-agents`，[`AGENTS_DIR_NAME`]）。
    pub agents_dir: PathBuf,
    /// 桌面版自带的 Node（`RUST_API_NODE_DIR`）：代装 npm 包、起托管的 npm 包、跑互动块的检查器时用。
    pub node_dir: Option<PathBuf>,
    /// `RETAINPDF_NODE_BIN`：桌面版指向 Electron 本体（排版引擎、Word 导出也用它，起子进程时带 `ELECTRON_RUN_AS_NODE=1`）；
    /// 没有 `RUST_API_NODE_DIR` 时 openui-check 退回用它（2026-11-26）。
    pub node_bin: Option<PathBuf>,
    /// 互动块的说明文件目录（`contracts/openui/`，[`default_openui_dir`]）；没有就不开互动块。
    pub openui_dir: Option<PathBuf>,
    /// 互动块的检查器包（`backend/openui-check/`，[`default_openui_check_dir`]）；没有时 `openui_check` 回「检查器用不了」。
    pub openui_check_dir: Option<PathBuf>,
}

impl AcpConfig {
    fn local_reason(&self) -> String {
        gate::local_agents_reason(self.multi_user, self.listens_on_loopback, self.local_agents_flag.as_deref())
    }

    fn lookup(&self) -> registry::Lookup<'_> {
        registry::Lookup {
            path_var: self.path_var.as_deref(),
            agents_dir: Some(self.agents_dir.as_path()),
            node_dir: self.node_dir.as_deref(),
        }
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
    let mut agents = registry::list_agents(&reason, &config.lookup());
    // 自带的两个排最前：retainpdf、retainpdf-pi
    agents.insert(1.min(agents.len()), pi::pi_view(config, &reason));
    AgentsView { agents, local_agents: LocalAgentsView { enabled: reason.is_empty(), reason } }
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

/// 这个 agent 用不用设置里的模型、读不读书（握手的 model、credential_ref、job_id 给它）：自带的两个。
pub fn is_builtin_agent(agent_id: &str) -> bool {
    agent_id == BUILTIN_AGENT_ID || agent_id == PI_AGENT_ID
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
    let openui_env = openui::openui_env(config);
    SessionDefaults {
        cwd: Some(cwd.to_path_buf()),
        mcp_server: cli.map(|cli| bridge::retainpdf_mcp_server(&cli, keys.first().map(|key| key.as_str()), &openui_env)),
        hide_model_option: false,
    }
}

/// 自带 agent（Python 的和 pi 的）用的模型配置：握手的 model / base_url / api_protocol / thinking，密钥从凭据库按引用取。
pub(crate) struct ModelSettings {
    pub model: String,
    pub base_url: String,
    pub protocol: String,
    pub thinking: String,
    pub secret: String,
}

fn model_settings(config: &AcpConfig, query: &AcpConnectQuery) -> Result<ModelSettings, AppError> {
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
    Ok(ModelSettings {
        model: model.into(),
        base_url: base_url.into(),
        protocol: protocol.into(),
        thinking: query.thinking.trim().into(),
        secret: credential.secret,
    })
}

/// 读书用的环境变量（书、后端地址、读书密钥）；没有书、没有密钥就不给。
fn book_env(config: &AcpConfig, book: Option<&AskBook>) -> Vec<(String, String)> {
    let Some(book) = book else {
        return Vec::new();
    };
    match reading_key(config) {
        Some(key) => vec![
            (ASK_ENV_JOB_ID.into(), book.job_id.clone()),
            (ASK_ENV_DOCUMENT_ID.into(), book.document_id.clone().unwrap_or_default()),
            (ASK_ENV_BACKEND_URL.into(), config.backend_url.clone()),
            (ASK_ENV_BACKEND_KEY.into(), key),
        ],
        // 没有任何密钥（不该发生：认证都过不了）就不给工具
        None => {
            tracing::warn!("acp bridge: no key for the built-in agent to read the book; it gets no tools");
            Vec::new()
        }
    }
}

fn builtin_process(
    config: &AcpConfig,
    query: &AcpConnectQuery,
    cwd: &Path,
    book: Option<&AskBook>,
) -> Result<AgentProcess, AppError> {
    let settings = model_settings(config, query)?;
    let mut env = vec![
        (ASK_ENV_MODEL.into(), settings.model),
        (ASK_ENV_BASE_URL.into(), settings.base_url),
        (ASK_ENV_API_PROTOCOL.into(), settings.protocol),
        (ASK_ENV_THINKING.into(), settings.thinking),
        (ASK_ENV_API_KEY.into(), settings.secret),
    ];
    env.extend(book_env(config, book));
    env.extend(openui::openui_env(config));
    Ok(AgentProcess {
        program: PathBuf::from(&config.python_bin),
        args: vec!["-m".into(), registry::BUILTIN_AGENT_MODULE.into()],
        env,
        cwd: Some(cwd.to_path_buf()),
        scratch_dir: None,
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
    } else if agent_id == PI_AGENT_ID {
        // pi 起的是本机装的 pi-acp、pi：和本机 agent 同一道闸门
        check_local_gate(config, headers)?;
        let process = pi::pi_process(config, query, &cwd, book)?;
        // pi-acp 不把 mcpServers 交给 pi，书由扩展自己读，不补 retainpdf mcp
        // pi-acp 报的选模型那一项去掉（模型是设置里存的连接），思考档位照转
        return Ok((process, SessionDefaults { cwd: Some(cwd), mcp_server: None, hide_model_option: true }));
    } else if registry::is_local_agent(agent_id) {
        check_local_gate(config, headers)?;
        let launch = registry::resolve_local_agent(agent_id, &config.lookup())
            .expect("is_local_agent checked")
            .map_err(AppError::not_found)?;
        AgentProcess { program: launch.program, args: launch.args, env: launch.env, cwd: Some(cwd.clone()), scratch_dir: None }
    } else {
        return Err(AppError::not_found(format!("unknown agent {agent_id:?}")));
    };
    Ok((process, session_defaults(config, &cwd)))
}

/// 本机 agent 的闸门（整个后端 + 这次握手），`retainpdf-pi` 和代装也走它。
fn check_local_gate(config: &AcpConfig, headers: &HeaderMap) -> Result<(), AppError> {
    let reason = config.local_reason();
    if !reason.is_empty() {
        return Err(AppError::forbidden(reason));
    }
    if let Some(reason) = gate::handshake_reason(headers) {
        return Err(AppError::forbidden(reason));
    }
    Ok(())
}

/// `POST /ai/agents/:agent_id/install`：把一个本机 agent 装进后端自己的安装目录（后台装，马上返回）。
/// 返回这个 agent 现在的样子（`install_status.state` 是 `installing`，或者已经装好了是 `installed`）。
/// 闸门和起本机 agent 一样（单机、只在本机监听、握手的 Host 是本机地址、没经过代理）。
pub fn install_agent(config: &AcpConfig, agent_id: &str, headers: &HeaderMap) -> Result<AgentView, AppError> {
    if is_builtin_agent(agent_id) {
        return Err(AppError::bad_request("the built-in agent needs no installation"));
    }
    let platform = registry::current_platform();
    install_agent_on(registry::catalog(), &platform, config, agent_id, headers)
}

fn install_agent_on(
    catalog: &registry::Catalog,
    platform: &str,
    config: &AcpConfig,
    agent_id: &str,
    headers: &HeaderMap,
) -> Result<AgentView, AppError> {
    let Some(agent) = registry::find_agent(catalog, agent_id, platform) else {
        return Err(AppError::not_found(format!("unknown agent {agent_id:?}")));
    };
    check_local_gate(config, headers)?;
    let lookup = config.lookup();
    let view = |lookup: &registry::Lookup| registry::local_view(agent, "", platform, lookup);
    let current = view(&lookup);
    let status = current.install_status.as_ref().expect("local agents have an install status when the gate is open");
    // 安装目录里已经是快照的版本、或者正在装：不再装
    if status.state == InstallState::Installing
        || (status.managed && status.installed_version.as_deref() == Some(install::version_dir_name(&agent.version).as_str()))
    {
        return Ok(current);
    }
    let plan = install::install_plan(agent, platform, &lookup)
        .map_err(|reason| AppError::conflict_because("agent_not_installable", reason))?;
    if install::begin(&agent.registry_id) {
        let job = install::InstallJob::new(agent, plan, &config.agents_dir, &lookup);
        let registry_id = agent.registry_id.clone();
        tokio::spawn(async move {
            let result = install::run_install(&job).await;
            install::finish(&registry_id, &result);
        });
    }
    Ok(view(&lookup))
}

/// 后端启动时：设了 `RUST_API_ACP_DEFAULT_INSTALL=1`（桌面版）、本机 agent 开着，就在后台把名单 `default_install`
/// 里没装的装上（pi-acp 连 pi、Claude Code 的适配器）。不挡启动，失败只记日志和状态。
pub fn spawn_default_installs(config: AcpConfig, flag: Option<&str>) -> Option<tokio::task::JoinHandle<()>> {
    if !install::default_install_enabled(flag) {
        return None;
    }
    let reason = config.local_reason();
    if !reason.is_empty() {
        tracing::info!("acp default install skipped: {reason}");
        return None;
    }
    Some(tokio::spawn(async move {
        let platform = registry::current_platform();
        install::install_defaults(registry::catalog(), &platform, &config.agents_dir, &config.lookup()).await;
    }))
}

#[cfg(test)]
mod install_tests;
#[cfg(test)]
mod tests;
