//! `retainpdf-pi`：用 pi 做的自带 agent（2026-11-26，方案 docs/ops/planning/reader-ask/20261126-RetainPDF加pi.md）。
//!
//! 和 `retainpdf`（Python）一样用设置里的模型、读这本书，区别是 agent 骨架换成 pi：桥起本机装的 pi-acp，
//! `PI_ACP_PI_COMMAND` 指向我们的包装脚本 `backend/pi-agent/bin/retainpdf-pi`，脚本在 pi-acp 给的参数后面加上锁定的参数
//! （只开读书的三个工具、不读用户的扩展 / skill / `AGENTS.md`、不连 MCP、不联网更新），用 `-e` 加载我们的扩展
//! `backend/pi-agent/extension/index.ts`。
//!
//! - 「装了没有」走登记表里 pi-acp 的解析（`registry::resolve_local_agent_and_requirement`，pi-acp 要 PATH 上另有 pi）。
//! - pi 起的是用户本机装的 Node 程序，和本机 agent 同一道闸门（单机、只在本机监听、本机地址打开、没经过代理）。
//! - 每次连接一个私有配置目录（`PI_CODING_AGENT_DIR`）：`models.json` 只有一个服务商 `retainpdf`，`apiKey` 写
//!   `$RETAIN_ASK_API_KEY`（密钥只在环境变量里，不落盘），`settings.json` 关掉缓存保温、安装统计、项目信任；没有 `auth.json`。
//!   连接结束时删掉（[`super::bridge`] 的 `scratch_dir`），没删掉的（握手后没升级）下次起时扫掉两天前的。
//! - pi-acp 的 `HOME` 换成 `<数据目录>/ask-pi/home`：它的会话对照表、它列斜杠命令时读的 `~/.pi/agent/prompts` 都不碰用户的 `~/.pi`。
//!   pi 本身由包装脚本换回用户的 `HOME`（pi 的安装器把 Node 放在 `~/.local/share/pi-node`），配置目录照旧是私有的。
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use retainpdf_api_base::error::AppError;
use serde_json::{json, Value};

use super::registry::{self, AgentKind, AgentView};
use super::{book_env, model_settings, AcpConfig, AcpConnectQuery, AgentProcess, AskBook, ModelSettings, ASK_ENV_API_KEY, ASK_ENV_MODEL};

pub const PI_AGENT_ID: &str = "retainpdf-pi";
/// 登记表里的 pi 适配器（找它和它要的 pi）。
const PI_ACP_ID: &str = "pi-acp";
/// 相对 `backend/`。
const PI_WRAPPER: &str = "pi-agent/bin/retainpdf-pi";
const PI_EXTENSION: &str = "pi-agent/extension/index.ts";
/// 提示词沿用 Python 自带 agent 的那两份，不另抄一份。
const ASK_PROMPTS_DIR: &str = "ask-agent/retainpdf_ask_agent/prompts";
const ASK_PROMPT_FILES: [&str; 2] = ["ask_system.txt", "ask_tools.txt"];
/// models.json 里的服务商名（`--model retainpdf/<模型>`）。
pub(super) const PI_PROVIDER: &str = "retainpdf";
pub(super) const PI_TOOLS: [&str; 3] = ["read_pages", "search_book", "view_page"];
/// 没被连接结束时删掉的私有配置目录，多久以后扫掉。
const STALE_CONNECTION_AGE: Duration = Duration::from_secs(2 * 24 * 3600);
/// 和 Python 版 `__main__.py` 一样估上下文窗口。
const ANTHROPIC_CONTEXT_WINDOW: u64 = 200_000;
const FALLBACK_CONTEXT_WINDOW: u64 = 128_000;
const MAX_OUTPUT_TOKENS: u64 = 16_384;
const ANTHROPIC_DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
/// 和 Python 版一样：OpenAI 协议没填地址时用 DeepSeek 的（`retainpdf_ask_agent_engine` 的 DEFAULT_BASE_URL）。
const OPENAI_DEFAULT_BASE_URL: &str = "https://api.deepseek.com/v1";

/// 包装脚本、提示词目录（都在仓库的 `backend/` 下）。
struct PiFiles {
    wrapper: PathBuf,
    prompts_dir: PathBuf,
}

/// 本机装的 pi-acp 和 pi。
struct PiInstall {
    pi_acp: PathBuf,
    pi_acp_args: Vec<String>,
    pi_acp_env: Vec<(String, String)>,
    pi: PathBuf,
}

/// 不能用的原因和（能装的话）安装命令。
type NotReady = (String, Option<String>);

fn pi_files(config: &AcpConfig) -> Result<PiFiles, String> {
    let missing = || "没找到 RetainPDF 的 pi 扩展（backend/pi-agent），这个安装包没带".to_string();
    let backend = config.backend_root.as_deref().ok_or_else(missing)?;
    let wrapper = backend.join(PI_WRAPPER);
    if !wrapper.is_file() || !backend.join(PI_EXTENSION).is_file() {
        return Err(missing());
    }
    let prompts_dir = backend.join(ASK_PROMPTS_DIR);
    if ASK_PROMPT_FILES.iter().any(|name| !prompts_dir.join(name).is_file()) {
        return Err("没找到自带 agent 的提示词（backend/ask-agent/…/prompts），这个安装包没带".into());
    }
    Ok(PiFiles { wrapper, prompts_dir })
}

fn pi_install(config: &AcpConfig) -> Result<PiInstall, NotReady> {
    match registry::resolve_local_agent_and_requirement(PI_ACP_ID, &config.lookup()) {
        Some(Ok((launch, Some(pi)))) => Ok(PiInstall { pi_acp: launch.program, pi_acp_args: launch.args, pi_acp_env: launch.env, pi }),
        Some(Ok((_, None))) => Err(("没找到 pi".into(), Some("npm install -g @earendil-works/pi-coding-agent".into()))),
        Some(Err((reason, install))) => Err((reason, install)),
        None => Err(("这个平台上起不了 pi-acp".into(), None)),
    }
}

fn pi_ready(config: &AcpConfig, local_reason: &str) -> Result<(PiFiles, PiInstall), NotReady> {
    if cfg!(windows) {
        return Err(("RetainPDF + pi 暂时只支持 macOS、Linux".into(), None));
    }
    if !local_reason.is_empty() {
        return Err((local_reason.to_string(), None));
    }
    let files = pi_files(config).map_err(|reason| (reason, None))?;
    let install = pi_install(config)?;
    Ok((files, install))
}

/// `GET /ai/agents` 里的这一行：归自带那一类（用设置里的模型），能不能用看闸门、装没装 pi-acp 和 pi。
pub(super) fn pi_view(config: &AcpConfig, local_reason: &str) -> AgentView {
    let (available, reason, install) = match pi_ready(config, local_reason) {
        Ok(_) => (true, String::new(), None),
        Err((reason, install)) => (false, reason, install),
    };
    AgentView {
        id: PI_AGENT_ID.into(),
        name: "RetainPDF + pi".into(),
        kind: AgentKind::Builtin,
        available,
        reason,
        launch: None,
        install,
        registry_id: None,
        description: Some("用设置里的模型，agent 骨架是本机装的 pi（只读这本书，没有 bash、不改文件）".into()),
        version: None,
        homepage: Some("https://github.com/earendil-works/pi".into()),
        license: None,
        distribution: None,
        install_url: None,
        featured: false,
        // 自带类：不由后端代装（pi-acp、pi 的安装状态看本机 agent 列表里的 pi-acp）
        install_status: None,
    }
}

/// 设置里的思考档位 → pi 的 `--thinking`。「自动」（前端「关」时也不传）：Anthropic 用 low（和 Python 版对
/// claude-haiku-5-5 的自动档一样），其余 off；max 要模型在 pi 里另登记，先按 high。
pub(super) fn pi_thinking(protocol: &str, thinking: &str) -> &'static str {
    match thinking.trim().to_ascii_lowercase().as_str() {
        "off" => "off",
        "low" => "low",
        "medium" => "medium",
        "high" | "max" => "high",
        _ if protocol == "anthropic" => "low",
        _ => "off",
    }
}

/// 设置里的地址 → pi 的 `baseUrl`。Anthropic 的 SDK 写法不带 `/v1`（设置里常填 `https://api.anthropic.com/v1`）。
pub(super) fn pi_base_url(protocol: &str, base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if protocol == "anthropic" {
        if trimmed.is_empty() {
            return ANTHROPIC_DEFAULT_BASE_URL.into();
        }
        let without_messages = trimmed.strip_suffix("/messages").unwrap_or(trimmed);
        return without_messages.strip_suffix("/v1").unwrap_or(without_messages).to_string();
    }
    if trimmed.is_empty() { OPENAI_DEFAULT_BASE_URL.into() } else { trimmed.to_string() }
}

fn pi_api(protocol: &str) -> &'static str {
    match protocol {
        "anthropic" => "anthropic-messages",
        "openai_responses" => "openai-responses",
        _ => "openai-completions",
    }
}

/// 模型在 pi 里的兼容开关（都是 2026-11-26 真机核过的）：
/// - Claude 4.6 以后（claude-haiku-5-5）只认 adaptive 思考，pi 对不认识的模型默认发 `thinking.type: enabled`，回 400；
/// - OpenAI 兼容的服务（DashScope 的 qwen3.8-flash）不认 `developer` 角色，只有 api.openai.com 认。
fn pi_compat(protocol: &str, base_url: &str) -> Value {
    if protocol == "anthropic" {
        return json!({"forceAdaptiveThinking": true});
    }
    let host = url::Url::parse(base_url).ok().and_then(|url| url.host_str().map(str::to_ascii_lowercase)).unwrap_or_default();
    if host == "api.openai.com" { json!({}) } else { json!({"supportsDeveloperRole": false}) }
}

/// 私有配置目录里的 `models.json`：一个服务商 `retainpdf`、一个模型；`apiKey` 只写环境变量名。
pub(super) fn models_json(settings: &ModelSettings) -> Value {
    let base_url = pi_base_url(&settings.protocol, &settings.base_url);
    let context = if settings.protocol == "anthropic" { ANTHROPIC_CONTEXT_WINDOW } else { FALLBACK_CONTEXT_WINDOW };
    json!({
        "providers": {
            PI_PROVIDER: {
                "baseUrl": base_url,
                "api": pi_api(&settings.protocol),
                "apiKey": format!("${ASK_ENV_API_KEY}"),
                "models": [{
                    "id": settings.model,
                    "name": settings.model,
                    "reasoning": true,
                    "input": ["text", "image"],
                    "contextWindow": context,
                    "maxTokens": MAX_OUTPUT_TOKENS,
                    "compat": pi_compat(&settings.protocol, &base_url),
                }],
            }
        }
    })
}

/// 私有配置目录里的 `settings.json`：默认就是这个模型和这三个工具；关掉缓存保温（空闲时也会发请求、花钱）、安装统计、
/// skill 命令；项目信任一律不给（书文件夹里有 `.pi/` 也不加载）。
pub(super) fn settings_json(settings: &ModelSettings, thinking: &str, sessions_dir: &Path) -> Value {
    json!({
        "defaultProvider": PI_PROVIDER,
        "defaultModel": settings.model,
        "defaultThinkingLevel": thinking,
        "enabledModels": [format!("{PI_PROVIDER}/{}", settings.model)],
        "defaultTools": PI_TOOLS,
        "defaultProjectTrust": "never",
        "sessionDir": sessions_dir.to_string_lossy(),
        "cacheWarming": "off",
        "enableInstallTelemetry": false,
        "enableSkillCommands": false,
        "quietStartup": true,
    })
}

/// `<数据目录>/ask-pi/`：`home/`（pi-acp 的 HOME）、`sessions/`（pi 的会话）、`connections/<编号>/`（每次连接的配置目录）。
fn pi_data_dir(config: &AcpConfig) -> PathBuf {
    config.data_root.join("ask-pi")
}

/// 扫掉没被删掉的旧连接目录（握手后没升级成 WebSocket 的那种）。
fn sweep_stale_connections(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let old = entry
            .metadata()
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age > STALE_CONNECTION_AGE);
        if old {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

fn write_json(path: &Path, value: &Value) -> std::io::Result<()> {
    std::fs::write(path, serde_json::to_vec_pretty(value).unwrap_or_default())
}

/// 一次握手：起 pi-acp（加上包装脚本、私有配置目录、模型和读书的环境变量）。闸门由调用方先查。
pub(super) fn pi_process(
    config: &AcpConfig,
    query: &AcpConnectQuery,
    cwd: &Path,
    book: Option<&AskBook>,
) -> Result<AgentProcess, AppError> {
    let (files, install) = pi_ready(config, &config.local_reason()).map_err(|(reason, _)| AppError::not_found(reason))?;
    let settings = model_settings(config, query)?;
    let thinking = pi_thinking(&settings.protocol, &settings.thinking);

    let root = pi_data_dir(config);
    let home = root.join("home");
    let sessions = root.join("sessions");
    let connections = root.join("connections");
    sweep_stale_connections(&connections);
    let agent_dir = connections.join(format!(
        "{}-{:016x}",
        SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|elapsed| elapsed.as_secs()).unwrap_or_default(),
        fastrand::u64(..)
    ));
    let io_error = |error: std::io::Error| AppError::internal(format!("cannot prepare the pi config directory: {error}"));
    for dir in [&home, &sessions, &agent_dir] {
        std::fs::create_dir_all(dir).map_err(io_error)?;
    }
    write_json(&agent_dir.join("models.json"), &models_json(&settings)).map_err(io_error)?;
    write_json(&agent_dir.join("settings.json"), &settings_json(&settings, thinking, &sessions)).map_err(io_error)?;

    let path = |path: &Path| path.to_string_lossy().into_owned();
    let mut env = install.pi_acp_env;
    env.extend([
        ("PI_ACP_PI_COMMAND".to_string(), path(&files.wrapper)),
        ("RETAIN_PI_BIN".into(), path(&install.pi)),
        ("RETAIN_PI_PROMPTS_DIR".into(), path(&files.prompts_dir)),
        ("RETAIN_PI_THINKING".into(), thinking.into()),
        ("RETAIN_PI_SESSION_DIR".into(), path(&sessions)),
        ("PI_CODING_AGENT_DIR".into(), path(&agent_dir)),
        ("PI_CODING_AGENT_SESSION_DIR".into(), path(&sessions)),
        ("PI_OFFLINE".into(), "1".into()),
        ("PI_SKIP_VERSION_CHECK".into(), "1".into()),
        ("PI_TELEMETRY".into(), "0".into()),
        ("HOME".into(), path(&home)),
        (ASK_ENV_MODEL.into(), settings.model.clone()),
        (ASK_ENV_API_KEY.into(), settings.secret.clone()),
    ]);
    if let Some(user_home) = std::env::var_os("HOME").filter(|home| !home.is_empty()) {
        env.push(("RETAIN_PI_USER_HOME".into(), user_home.to_string_lossy().into_owned()));
    }
    env.extend(book_env(config, book));
    Ok(AgentProcess {
        program: install.pi_acp,
        args: install.pi_acp_args,
        env,
        cwd: Some(cwd.to_path_buf()),
        scratch_dir: Some(agent_dir),
    })
}
