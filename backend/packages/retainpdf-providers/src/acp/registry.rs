//! 能接的 agent 登记表：自带的（Python `retainpdf_ask_agent`）和本机装的（Claude Code、Codex、Gemini CLI）。
//!
//! 只起这里写死的命令，参数不收客户端给的。本机 agent 的包名、参数 2026-11-25 前端在 npm 和官方文档核实过：
//! `@agentclientprotocol/claude-agent-acp`（命令 claude-agent-acp）、`@agentclientprotocol/codex-acp`（codex-acp）；
//! Gemini CLI 用 `--acp`（`--experimental-acp` 是旧写法，旧版要先升级）。不现场 npx 下载（见 [`LocalAgent`]），没装的给安装命令。
use std::path::{Path, PathBuf};

use serde::Serialize;

pub const BUILTIN_AGENT_ID: &str = "retainpdf";
/// 自带 agent 的 Python 模块（`python_bin -m retainpdf_ask_agent`，和翻译 worker 同一个环境）。
pub const BUILTIN_AGENT_MODULE: &str = "retainpdf_ask_agent";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    Builtin,
    Local,
}

/// 一种本机 agent：直接起的 ACP 命令（在 PATH 里找，不经 shell），没装时告诉用户怎么装。
///
/// 2026-11-25 以前没装单独的适配器时用 `npx -y <包>` 现场下载再起：Claude Code 的适配器第一次要下约 384 MB，
/// 下到一半连接断了，桥结束 npx，`~/.npm/_npx` 里留下只写了一半的可执行文件，之后每次都报 `spawn ... -88`
/// （macOS EBADMACHO），自己恢复不了（前端真机联调踩到）。现在不再现场下载：没装就列成不能用，`install` 给安装命令。
struct LocalAgent {
    id: &'static str,
    name: &'static str,
    program: &'static str,
    args: &'static [&'static str],
    install: &'static str,
}

const LOCAL_AGENTS: &[LocalAgent] = &[
    LocalAgent {
        id: "claude-code",
        name: "Claude Code",
        program: "claude-agent-acp",
        args: &[],
        install: "npm install -g @agentclientprotocol/claude-agent-acp",
    },
    LocalAgent {
        id: "codex",
        name: "Codex",
        program: "codex-acp",
        args: &[],
        install: "npm install -g @agentclientprotocol/codex-acp",
    },
    LocalAgent {
        id: "gemini",
        name: "Gemini CLI",
        program: "gemini",
        args: &["--acp"],
        install: "npm install -g @google/gemini-cli",
    },
];

/// `GET /ai/agents` 里的一项。
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AgentView {
    pub id: String,
    pub name: String,
    pub kind: AgentKind,
    pub available: bool,
    /// 不能用的原因；能用时是空串。
    pub reason: String,
    /// 本机 agent 实际怎么起（给用户看）；自带的、没装的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch: Option<String>,
    /// 本机 agent 的安装命令（在终端跑一次）；自带的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install: Option<String>,
}

/// 选中的起法：绝对路径的程序和参数。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedLaunch {
    pub program: PathBuf,
    pub args: Vec<String>,
}

/// 在 PATH 里找可执行文件（不经 shell）。
pub fn find_in_path(program: &str, path_var: Option<&std::ffi::OsStr>) -> Option<PathBuf> {
    let path_var = path_var?;
    std::env::split_paths(path_var)
        .map(|dir| dir.join(program))
        .find(|candidate| is_executable(candidate))
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata().map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

fn resolve_local(agent: &LocalAgent, path_var: Option<&std::ffi::OsStr>) -> Result<ResolvedLaunch, String> {
    find_in_path(agent.program, path_var)
        .map(|program| ResolvedLaunch { program, args: agent.args.iter().map(|arg| arg.to_string()).collect() })
        .ok_or_else(|| format!("没装 {}：先在终端运行 {}", agent.program, agent.install))
}

/// 本机 agent 的起法（`id` 不认识返回 None）。
pub fn resolve_local_agent(id: &str, path_var: Option<&std::ffi::OsStr>) -> Option<Result<ResolvedLaunch, String>> {
    LOCAL_AGENTS.iter().find(|agent| agent.id == id).map(|agent| resolve_local(agent, path_var))
}

pub fn is_local_agent(id: &str) -> bool {
    LOCAL_AGENTS.iter().any(|agent| agent.id == id)
}

/// 列出所有 agent。`local_reason` 不空时本机 agent 一律不能用（服务器、多用户、监听非回环……）。
pub fn list_agents(local_reason: &str, path_var: Option<&std::ffi::OsStr>) -> Vec<AgentView> {
    let mut views = vec![AgentView {
        id: BUILTIN_AGENT_ID.into(),
        name: "RetainPDF 自带模型".into(),
        kind: AgentKind::Builtin,
        available: true,
        reason: String::new(),
        launch: None,
        install: None,
    }];
    for agent in LOCAL_AGENTS {
        let (available, reason, launch) = if !local_reason.is_empty() {
            (false, local_reason.to_string(), None)
        } else {
            match resolve_local(agent, path_var) {
                Ok(resolved) => {
                    let program = resolved.program.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
                    (true, String::new(), Some([program].into_iter().chain(resolved.args).collect::<Vec<_>>().join(" ")))
                }
                Err(reason) => (false, reason, None),
            }
        };
        views.push(AgentView {
            id: agent.id.into(),
            name: agent.name.into(),
            kind: AgentKind::Local,
            available,
            reason,
            launch,
            install: Some(agent.install.into()),
        });
    }
    views
}
