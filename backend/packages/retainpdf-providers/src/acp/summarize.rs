//! 阅读页提问的压缩摘要（2026-11-26 第二期）：起 `python -m retainpdf_ask_agent summarize`，用用户设置里那条模型
//! 把一段对话压成摘要。主对话太长时的压缩、副对话结束时的结论卡片都走这里（书库包 `ask_conversations.rs` 调）。
//!
//! 模型配置和问答握手同一套（`model`、`base_url`、`api_protocol`、`thinking`、`credential_ref`），密钥从凭据库按引用取，
//! 只经环境变量交给子进程，不落盘；stdin 一个 JSON、stdout 一行 JSON（`{"summary", "usage"}`，出错 `{"error"}`）。
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Deserialize;

use super::{model_settings, registry, AcpConfig, AcpConnectQuery};
use super::{ASK_ENV_API_KEY, ASK_ENV_API_PROTOCOL, ASK_ENV_BASE_URL, ASK_ENV_MODEL, ASK_ENV_THINKING};
use retainpdf_api_base::error::AppError;

/// 一次压缩最多等多久（模型慢、一大段对话）。
const SUMMARIZE_TIMEOUT: Duration = Duration::from_secs(180);
/// stdout 最多读多少（一份摘要本来就几千字）。
const MAX_OUTPUT_BYTES: usize = 256 * 1024;

/// 子进程回来的东西。
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct AskSummary {
    pub summary: String,
    #[serde(default)]
    pub usage: serde_json::Value,
}

#[derive(Deserialize)]
struct Reply {
    summary: Option<String>,
    #[serde(default)]
    usage: serde_json::Value,
    error: Option<String>,
}

/// 用 `connection`（握手同一套字段，只看模型那几项）把 `request` 交给 summarize 子命令。
/// 模型配置不对回 400；子进程出错、超时、没回摘要回 502（`ask_summarize_failed`，`message` 是原因）。
pub fn summarize_ask_conversation(
    config: &AcpConfig,
    connection: &AcpConnectQuery,
    request: &serde_json::Value,
) -> Result<AskSummary, AppError> {
    let settings = model_settings(config, connection)?;
    let mut child = Command::new(&config.python_bin)
        .args(["-m", registry::BUILTIN_AGENT_MODULE, "summarize"])
        .env(ASK_ENV_MODEL, &settings.model)
        .env(ASK_ENV_BASE_URL, &settings.base_url)
        .env(ASK_ENV_API_PROTOCOL, &settings.protocol)
        .env(ASK_ENV_THINKING, &settings.thinking)
        .env(ASK_ENV_API_KEY, &settings.secret)
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONUTF8", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| failed(format!("cannot start the summarizer: {error}")))?;
    let input = serde_json::to_vec(request).map_err(|error| failed(error.to_string()))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(&input).map_err(|error| failed(format!("cannot send the conversation: {error}")))?;
    }
    let mut stdout = child.stdout.take().expect("piped stdout");
    let mut stderr = child.stderr.take().expect("piped stderr");
    let reader = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = (&mut stdout).take(MAX_OUTPUT_BYTES as u64).read_to_end(&mut buffer);
        buffer
    });
    let err_reader = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = (&mut stderr).take(64 * 1024).read_to_end(&mut buffer);
        buffer
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= SUMMARIZE_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(failed(format!("the summarizer took longer than {} seconds", SUMMARIZE_TIMEOUT.as_secs())));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(error) => return Err(failed(format!("cannot wait for the summarizer: {error}"))),
        }
    };
    let out = reader.join().unwrap_or_default();
    let err = err_reader.join().unwrap_or_default();
    let line = String::from_utf8_lossy(&out);
    let reply: Option<Reply> = line.lines().rev().find(|line| !line.trim().is_empty()).and_then(|line| serde_json::from_str(line).ok());
    match reply {
        Some(Reply { summary: Some(summary), usage, .. }) if status.success() && !summary.trim().is_empty() => {
            Ok(AskSummary { summary: summary.trim().to_string(), usage })
        }
        Some(Reply { error: Some(error), .. }) => Err(failed(error)),
        _ => {
            let tail = String::from_utf8_lossy(&err);
            let last = tail.lines().rev().find(|line| !line.trim().is_empty()).unwrap_or("").trim();
            Err(failed(format!("the summarizer exited with {status} without a summary: {last}")))
        }
    }
}

fn failed(message: impl Into<String>) -> AppError {
    AppError::bad_gateway_because("ask_summarize_failed", message.into())
}
