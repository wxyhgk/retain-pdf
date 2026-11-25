//! 能接的 agent 登记表：自带的（Python `retainpdf_ask_agent`）和本机装的（Claude Code、Codex、Gemini CLI）。
//!
//! 只起这里写死的命令，参数不收客户端给的。本机 agent 的包名、参数按 2026-11-25 前端的调研写（没在本机装过核实）；
//! 装法变了改这张表。
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

/// 一种起法：程序名（在 PATH 里找）、参数；`requires` 是这种起法要求本机已经装好的命令（比如走 npx 的要先装 CLI）。
struct Launch {
    program: &'static str,
    args: &'static [&'static str],
    requires: Option<&'static str>,
}

struct LocalAgent {
    id: &'static str,
    name: &'static str,
    /// 按顺序试，第一个能用的就用它。
    launches: &'static [Launch],
}

const LOCAL_AGENTS: &[LocalAgent] = &[
    LocalAgent {
        id: "claude-code",
        name: "Claude Code",
        launches: &[
            Launch { program: "claude-agent-acp", args: &[], requires: None },
            Launch { program: "npx", args: &["-y", "@agentclientprotocol/claude-agent-acp"], requires: Some("claude") },
        ],
    },
    LocalAgent {
        id: "codex",
        name: "Codex",
        launches: &[
            Launch { program: "codex-acp", args: &[], requires: None },
            Launch { program: "npx", args: &["-y", "@agentclientprotocol/codex-acp"], requires: Some("codex") },
        ],
    },
    LocalAgent {
        id: "gemini",
        name: "Gemini CLI",
        launches: &[Launch { program: "gemini", args: &["--experimental-acp"], requires: None }],
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
    /// 本机 agent 实际怎么起（给用户看）；自带的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch: Option<String>,
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
    for launch in agent.launches {
        if launch.requires.is_some_and(|required| find_in_path(required, path_var).is_none()) {
            continue;
        }
        if let Some(program) = find_in_path(launch.program, path_var) {
            return Ok(ResolvedLaunch { program, args: launch.args.iter().map(|arg| arg.to_string()).collect() });
        }
    }
    let wanted: Vec<&str> = agent.launches.iter().map(|launch| launch.requires.unwrap_or(launch.program)).collect();
    Err(format!("没找到 {} 命令", wanted.join(" / ")))
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
        views.push(AgentView { id: agent.id.into(), name: agent.name.into(), kind: AgentKind::Local, available, reason, launch });
    }
    views
}
