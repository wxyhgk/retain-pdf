//! ACP 桥：一个 WebSocket 连接对一个 agent 子进程（stdio，每行一条 JSON-RPC 2.0）。
//!
//! 两头原样转，只改一处：客户端发的 `session/new`、`session/load`，`cwd` 空着就填默认的（书文件夹），
//! `mcpServers` 里没有 `retainpdf` 就补上（`retainpdf mcp`，带 AI 专用密钥）。
//! 连接断了结束 agent；agent 退出了关连接（1011，原因写退出码和 stderr 最后一行）。
//!
//! 和 WebSocket 之间用两个通道：`incoming` 是客户端发来的文字消息，`outgoing` 是要发给客户端的（测试里直接接通道）。
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

pub const MCP_SERVER_NAME: &str = "retainpdf";
const AGENT_KEY_ENV: &str = "RETAINPDF_AGENT_KEY";
/// WebSocket 关闭原因最多 123 字节。
const MAX_CLOSE_REASON_BYTES: usize = 123;
const STDERR_TAIL_LINES: usize = 20;
/// 关闭码：agent 退出、起不来。
pub const CLOSE_AGENT_ENDED: u16 = 1011;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BridgeOut {
    Text(String),
    Close { code: u16, reason: String },
}

#[derive(Clone, Debug)]
pub struct AgentProcess {
    pub program: PathBuf,
    pub args: Vec<String>,
    /// 加在继承来的环境变量上（本机 agent 要 PATH、HOME 和它自己的登录状态）。
    pub env: Vec<(String, String)>,
    pub cwd: Option<PathBuf>,
    /// 这次连接专用的临时目录（`retainpdf-pi` 的私有 pi 配置目录）：连接结束时删掉。
    pub scratch_dir: Option<PathBuf>,
}

/// 连接结束（不管怎么结束的）时删掉这次连接的临时目录。
struct ScratchDir(Option<PathBuf>);

impl Drop for ScratchDir {
    fn drop(&mut self) {
        if let Some(dir) = self.0.take() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct SessionDefaults {
    /// `session/new`、`session/load` 的 `cwd` 空着时填它（绝对路径）。
    pub cwd: Option<PathBuf>,
    /// 补进 `mcpServers` 的那一项（[`retainpdf_mcp_server`]）；None 就不补。
    pub mcp_server: Option<Value>,
}

/// `retainpdf mcp` 的 ACP 写法（stdio MCP 服务：绝对路径、不经 shell，环境变量是 `{name, value}` 数组）。
/// `extra_env` 是互动块的说明文件、检查器的位置（`openui::openui_env`），有了 MCP 就多 L0 和两个工具。
pub fn retainpdf_mcp_server(cli: &Path, agent_key: Option<&str>, extra_env: &[(String, String)]) -> Value {
    let env: Vec<Value> = agent_key
        .filter(|key| !key.is_empty())
        .map(|key| json!({"name": AGENT_KEY_ENV, "value": key}))
        .into_iter()
        .chain(extra_env.iter().map(|(name, value)| json!({"name": name, "value": value})))
        .collect();
    json!({"name": MCP_SERVER_NAME, "command": cli.to_string_lossy(), "args": ["mcp"], "env": env})
}

/// 找 `retainpdf` 命令行：先找和后端可执行文件同目录的，再找 PATH。
pub fn find_retainpdf_cli(current_exe: Option<&Path>, path_var: Option<&std::ffi::OsStr>) -> Option<PathBuf> {
    let name = if cfg!(windows) { "retainpdf.exe" } else { "retainpdf" };
    current_exe
        .and_then(Path::parent)
        .map(|dir| dir.join(name))
        .filter(|candidate| candidate.is_file())
        .or_else(|| super::registry::find_in_path(name, path_var))
}

/// 客户端发来的一条消息 → 写给 agent 的一行（不带换行）。
pub fn prepare_client_message(text: &str, defaults: &SessionDefaults) -> String {
    let Ok(mut message) = serde_json::from_str::<Value>(text) else {
        // 不是 JSON 也照转（agent 会回解析错误），只是不能让它跨行
        return text.replace(['\n', '\r'], " ");
    };
    let method = message.get("method").and_then(Value::as_str).unwrap_or("");
    if matches!(method, "session/new" | "session/load") {
        if let Some(params) = message.get_mut("params").and_then(Value::as_object_mut) {
            let cwd_missing = params.get("cwd").and_then(Value::as_str).is_none_or(|cwd| cwd.trim().is_empty());
            if cwd_missing {
                if let Some(cwd) = &defaults.cwd {
                    params.insert("cwd".into(), Value::String(cwd.to_string_lossy().into_owned()));
                }
            }
            if let Some(server) = &defaults.mcp_server {
                let servers = params.entry("mcpServers").or_insert_with(|| Value::Array(Vec::new()));
                if let Some(list) = servers.as_array_mut() {
                    if !list.iter().any(|item| item.get("name").and_then(Value::as_str) == Some(MCP_SERVER_NAME)) {
                        list.push(server.clone());
                    }
                }
            }
        }
    }
    message.to_string()
}

fn close_reason(text: &str) -> String {
    let mut reason = String::new();
    for ch in text.chars() {
        if reason.len() + ch.len_utf8() > MAX_CLOSE_REASON_BYTES {
            break;
        }
        reason.push(ch);
    }
    reason
}

async fn send_close(outgoing: &mpsc::Sender<BridgeOut>, code: u16, reason: &str) {
    let _ = outgoing.send(BridgeOut::Close { code, reason: close_reason(reason) }).await;
}

/// 跑一个连接，直到客户端断开或 agent 退出。
pub async fn run_bridge(
    process: AgentProcess,
    defaults: SessionDefaults,
    mut incoming: mpsc::Receiver<String>,
    outgoing: mpsc::Sender<BridgeOut>,
) {
    let _scratch = ScratchDir(process.scratch_dir.clone());
    let mut command = Command::new(&process.program);
    command
        .args(&process.args)
        .envs(process.env.iter().map(|(key, value)| (key.as_str(), value.as_str())))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(cwd) = &process.cwd {
        command.current_dir(cwd);
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let name = process.program.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
            send_close(&outgoing, CLOSE_AGENT_ENDED, &format!("agent 起不来（{name}）：{error}")).await;
            return;
        }
    };
    let (Some(mut stdin), Some(stdout), Some(stderr)) = (child.stdin.take(), child.stdout.take(), child.stderr.take()) else {
        send_close(&outgoing, CLOSE_AGENT_ENDED, "agent 的输入输出接不上").await;
        return;
    };

    let tail: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let tail_writer = tail.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            tracing::debug!(target: "acp_bridge", "agent stderr: {line}");
            let mut tail = tail_writer.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
            if !line.trim().is_empty() {
                tail.push_back(line.chars().take(300).collect());
                while tail.len() > STDERR_TAIL_LINES {
                    tail.pop_front();
                }
            }
        }
    });

    let mut stdout_lines = BufReader::new(stdout).lines();
    let mut client_gone = false;
    loop {
        tokio::select! {
            message = incoming.recv() => match message {
                Some(text) => {
                    let line = prepare_client_message(&text, &defaults);
                    if stdin.write_all(line.as_bytes()).await.is_err()
                        || stdin.write_all(b"\n").await.is_err()
                        || stdin.flush().await.is_err()
                    {
                        break;
                    }
                }
                None => {
                    client_gone = true;
                    break;
                }
            },
            line = stdout_lines.next_line() => match line {
                Ok(Some(line)) => {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if outgoing.send(BridgeOut::Text(line)).await.is_err() {
                        client_gone = true;
                        break;
                    }
                }
                _ => break,
            },
        }
    }

    if client_gone {
        drop(stdin);
        let _ = child.start_kill();
        let _ = child.wait().await;
        stderr_task.abort();
        return;
    }
    // agent 不再输出：给它一点时间退出，再关连接
    drop(stdin);
    let status = match tokio::time::timeout(std::time::Duration::from_secs(2), child.wait()).await {
        Ok(Ok(status)) => status.code().map(|code| format!("退出码 {code}")).unwrap_or_else(|| "被信号结束".into()),
        _ => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            "不再输出，已结束".into()
        }
    };
    let _ = tokio::time::timeout(std::time::Duration::from_millis(500), stderr_task).await;
    let last = tail.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).back().cloned().unwrap_or_default();
    let reason = if last.is_empty() { format!("agent 结束了（{status}）") } else { format!("agent 结束了（{status}）：{last}") };
    send_close(&outgoing, CLOSE_AGENT_ENDED, &reason).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn defaults() -> SessionDefaults {
        SessionDefaults {
            cwd: Some(PathBuf::from("/data/books")),
            mcp_server: Some(retainpdf_mcp_server(Path::new("/opt/retainpdf/retainpdf"), Some("agent-key"), &[])),
        }
    }

    #[test]
    fn session_new_gets_cwd_and_the_retainpdf_mcp_server() {
        let line = prepare_client_message(
            "{\n \"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"session/new\", \"params\": {\"cwd\": \"\", \"mcpServers\": []}\n}",
            &defaults(),
        );
        assert!(!line.contains('\n'));
        let message: Value = serde_json::from_str(&line).unwrap();
        assert_eq!(message["params"]["cwd"], "/data/books");
        assert_eq!(
            message["params"]["mcpServers"],
            json!([{"name": "retainpdf", "command": "/opt/retainpdf/retainpdf", "args": ["mcp"],
                    "env": [{"name": "RETAINPDF_AGENT_KEY", "value": "agent-key"}]}])
        );
    }

    #[test]
    fn existing_cwd_and_retainpdf_entry_are_kept_and_other_messages_pass_through() {
        let original = json!({"jsonrpc": "2.0", "id": 2, "method": "session/load", "params": {
            "sessionId": "s", "cwd": "/home/me/notes",
            "mcpServers": [{"name": "retainpdf", "command": "/x/retainpdf", "args": ["mcp"], "env": []}]}});
        let line = prepare_client_message(&original.to_string(), &defaults());
        assert_eq!(serde_json::from_str::<Value>(&line).unwrap(), original);
        // 别的 MCP 服务留着，retainpdf 补在后面；mcpServers 没给就新建
        let line = prepare_client_message(r#"{"jsonrpc":"2.0","id":3,"method":"session/new","params":{"cwd":"/a","mcpServers":[{"name":"other","command":"/o","args":[],"env":[]}]}}"#, &defaults());
        let servers = serde_json::from_str::<Value>(&line).unwrap()["params"]["mcpServers"].clone();
        assert_eq!(servers.as_array().unwrap().len(), 2);
        let line = prepare_client_message(r#"{"jsonrpc":"2.0","id":4,"method":"session/new","params":{"cwd":"/a"}}"#, &defaults());
        assert_eq!(serde_json::from_str::<Value>(&line).unwrap()["params"]["mcpServers"][0]["name"], "retainpdf");
        let prompt = r#"{"jsonrpc":"2.0","id":5,"method":"session/prompt","params":{"sessionId":"s","prompt":[{"type":"text","text":"hi"}]}}"#;
        assert_eq!(serde_json::from_str::<Value>(&prepare_client_message(prompt, &defaults())).unwrap(), serde_json::from_str::<Value>(prompt).unwrap());
        assert_eq!(prepare_client_message("not json\nline", &defaults()), "not json line");
        // 没有 AI 专用密钥时不带 env
        assert_eq!(retainpdf_mcp_server(Path::new("/r"), None, &[])["env"], json!([]));
        let with_openui = retainpdf_mcp_server(Path::new("/r"), Some("k"), &[("RETAIN_OPENUI_PROMPT".into(), "/c/p.json".into())]);
        assert_eq!(
            with_openui["env"],
            json!([{"name": AGENT_KEY_ENV, "value": "k"}, {"name": "RETAIN_OPENUI_PROMPT", "value": "/c/p.json"}])
        );
    }

    #[test]
    fn close_reasons_fit_the_websocket_limit() {
        let reason = close_reason(&"中".repeat(100));
        assert!(reason.len() <= MAX_CLOSE_REASON_BYTES && reason.chars().all(|c| c == '中'));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn relays_both_ways_and_rewrites_session_new() {
        // cat 当回声 agent：发进去什么就原样回来，正好看到桥改过的 session/new
        let (to_bridge, incoming) = mpsc::channel(8);
        let (outgoing, mut from_bridge) = mpsc::channel(8);
        let process = AgentProcess { program: "/bin/cat".into(), args: vec![], env: vec![], cwd: None, scratch_dir: None };
        let task = tokio::spawn(run_bridge(process, defaults(), incoming, outgoing));
        to_bridge.send(r#"{"jsonrpc":"2.0","id":1,"method":"session/new","params":{"cwd":"","mcpServers":[]}}"#.into()).await.unwrap();
        let BridgeOut::Text(echo) = from_bridge.recv().await.unwrap() else { panic!("expected text") };
        let echo: Value = serde_json::from_str(&echo).unwrap();
        assert_eq!(echo["params"]["cwd"], "/data/books");
        assert_eq!(echo["params"]["mcpServers"][0]["name"], "retainpdf");
        // 客户端断开：桥结束 agent，自己也结束
        drop(to_bridge);
        tokio::time::timeout(std::time::Duration::from_secs(5), task).await.unwrap().unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn agent_exit_closes_the_connection_with_the_last_stderr_line() {
        let (_to_bridge, incoming) = mpsc::channel(8);
        let (outgoing, mut from_bridge) = mpsc::channel(8);
        let process = AgentProcess {
            program: "/bin/sh".into(),
            args: vec!["-c".into(), "echo '{\"jsonrpc\":\"2.0\",\"method\":\"hello\"}'; echo 'No module named retainpdf_ask_agent' >&2; exit 3".into()],
            env: vec![],
            cwd: None,
            scratch_dir: None,
        };
        let task = tokio::spawn(run_bridge(process, SessionDefaults::default(), incoming, outgoing));
        assert_eq!(from_bridge.recv().await.unwrap(), BridgeOut::Text(r#"{"jsonrpc":"2.0","method":"hello"}"#.into()));
        let BridgeOut::Close { code, reason } = from_bridge.recv().await.unwrap() else { panic!("expected close") };
        assert_eq!(code, CLOSE_AGENT_ENDED);
        assert!(reason.contains("退出码 3") && reason.contains("No module named"), "{reason}");
        tokio::time::timeout(std::time::Duration::from_secs(5), task).await.unwrap().unwrap();
    }

    #[tokio::test]
    async fn the_scratch_dir_is_removed_when_the_connection_ends() {
        let dir = std::env::temp_dir().join(format!("retainpdf-acp-scratch-{}-{}", std::process::id(), fastrand::u64(..)));
        std::fs::create_dir_all(dir.join("agent")).unwrap();
        std::fs::write(dir.join("agent").join("models.json"), "{}").unwrap();
        let (_to_bridge, incoming) = mpsc::channel(8);
        let (outgoing, mut from_bridge) = mpsc::channel(8);
        let process = AgentProcess { program: "/nonexistent/agent".into(), args: vec![], env: vec![], cwd: None, scratch_dir: Some(dir.clone()) };
        run_bridge(process, SessionDefaults::default(), incoming, outgoing).await;
        assert!(matches!(from_bridge.recv().await.unwrap(), BridgeOut::Close { .. }));
        assert!(!dir.exists());
    }

    #[tokio::test]
    async fn missing_program_closes_right_away() {
        let (_to_bridge, incoming) = mpsc::channel(8);
        let (outgoing, mut from_bridge) = mpsc::channel(8);
        let process = AgentProcess { program: "/nonexistent/agent".into(), args: vec![], env: vec![], cwd: None, scratch_dir: None };
        run_bridge(process, SessionDefaults::default(), incoming, outgoing).await;
        assert!(matches!(from_bridge.recv().await.unwrap(), BridgeOut::Close { code: CLOSE_AGENT_ENDED, reason } if reason.contains("起不来")));
    }
}
