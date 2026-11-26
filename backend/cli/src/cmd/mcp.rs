//! `retainpdf mcp`：给 AI agent 用的 MCP 服务（stdio，每行一条 JSON-RPC 2.0 消息），由 agent 当子进程起，不开端口。
//!
//! 书的内容 agent 直接读书文件夹（`<数据目录>/books/`，`retainpdf books export`）；这里只给两个工具：
//! - `revise_translation`：改一条译文（`PATCH /jobs/{job}/translations/{item}`，`source: "agent"`，带读到的旧译文，
//!   期间被改过就拒）；
//! - `view_page`：取原文页或译文页的图，给读不了 PDF 的 agent 看排版、公式、图表。
//!
//! 阅读页提问时（2026-11-26，`mcp_openui.rs`）：桥在 `env` 里给了互动块的说明文件和检查器，就在 `instructions` 后面接上 L0，
//! 多 `openui_spec`、`openui_check` 两个工具（不调后端）。
//!
//! 密钥：环境变量 `RETAINPDF_AGENT_KEY`（AI 专用密钥，后端 `RUST_API_AGENT_KEYS`）优先，没有就用 `backend.json` 里的主密钥。
//! 后端没开时照样启动、照样列出工具，调工具时再找后端（用户中途打开 RetainPDF 也能用上）。
//! stdout 只写协议消息；出错说明写进工具结果，日志写 stderr。

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::Result;
use base64::Engine;
use serde_json::{json, Value};

use crate::context::{BackendState, Ctx};

#[path = "mcp_openui.rs"]
pub mod openui;
use openui::OpenUi;

/// 这一版按 2025-06-18 写；客户端要的是下面认识的旧版本就回它要的。
const PROTOCOL_VERSION: &str = "2025-06-18";
const KNOWN_PROTOCOL_VERSIONS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];
const AGENT_KEY_ENV: &str = "RETAINPDF_AGENT_KEY";
const DEFAULT_PAGE_WIDTH: u64 = 1000;
const MAX_PAGE_WIDTH: u64 = 1600;
const MIN_PAGE_WIDTH: u64 = 240;

const INSTRUCTIONS: &str = "RetainPDF 书库。书的原文和译文在书文件夹（<数据目录>/books/，每本书一个文件夹：library.md 是总目录，\
text/ 下按章拆的 Markdown，原文和译文并排）里直接读、grep。每个块前面有锚点 <!-- p012-b0003 job=<任务编号> page=<书的页码> -->。\
要改译文用 revise_translation（job_id、item_id 照抄锚点，expected_old_text 填你读到的那句译文）；\
要看排版、公式、图表用 view_page。改译文前先跟用户说清楚改哪里、为什么。";

/// 发给后端的请求。正式运行是 HTTP（`context::Backend`），测试里换成假的。
pub trait Transport {
    fn json(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u16, Value)>;
    fn bytes(&self, path: &str) -> Result<(u16, Vec<u8>)>;
}

impl Transport for crate::context::Backend {
    fn json(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u16, Value)> {
        let method = reqwest::Method::from_bytes(method.as_bytes())?;
        self.call_raw(method, path, body)
    }

    fn bytes(&self, path: &str) -> Result<(u16, Vec<u8>)> {
        self.get_bytes(path)
    }
}

/// 找后端：每次调工具时找一次（后端可能中途才开），找不到给一句能照做的说明。
fn connect(json: bool, data: Option<PathBuf>) -> std::result::Result<Box<dyn Transport>, String> {
    let ctx = Ctx::load(json, data).map_err(|error| format!("读不了 RetainPDF 的配置：{error:#}"))?;
    match ctx.backend {
        BackendState::Running(backend) => {
            let backend = match std::env::var(AGENT_KEY_ENV).ok().map(|key| key.trim().to_string()).filter(|key| !key.is_empty()) {
                Some(key) => backend.with_api_key(key).map_err(|error| format!("{error:#}"))?,
                None => backend,
            };
            Ok(Box::new(backend))
        }
        BackendState::Stopped => Err("RetainPDF 没开（后端没在运行）：先打开 RetainPDF 再用这个工具。".into()),
        BackendState::Unreachable(runtime) => {
            Err(format!("RetainPDF 在运行但连不上 {}：等它启动完成再试。", runtime.api_base))
        }
    }
}

pub fn run(ctx: &Ctx, data: Option<PathBuf>) -> Result<ExitCode> {
    let json = ctx.json;
    let server = Server::new(move || connect(json, data.clone())).with_openui(OpenUi::from_env());
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        if let Some(reply) = server.handle_line(&line) {
            serde_json::to_writer(&mut stdout, &reply)?;
            stdout.write_all(b"\n")?;
            stdout.flush()?;
        }
    }
    Ok(ExitCode::SUCCESS)
}

pub struct Server<F> {
    connect: F,
    /// 互动块（桥给了说明文件才有）。
    openui: Option<OpenUi>,
}

impl<F> Server<F>
where
    F: Fn() -> std::result::Result<Box<dyn Transport>, String>,
{
    pub fn new(connect: F) -> Self {
        Self { connect, openui: None }
    }

    pub fn with_openui(mut self, openui: Option<OpenUi>) -> Self {
        self.openui = openui;
        self
    }

    /// 一行消息进来，要回就回一条（通知不回）。
    pub fn handle_line(&self, line: &str) -> Option<Value> {
        let message: Value = match serde_json::from_str(line) {
            Ok(message) => message,
            Err(_) => return Some(error_reply(Value::Null, -32700, "parse error")),
        };
        let id = message.get("id").cloned();
        let method = message.get("method").and_then(Value::as_str);
        let (Some(id), Some(method)) = (id, method) else {
            // 通知（没有 id）、客户端回给我们的响应（没有 method）：都不用回。
            return None;
        };
        let params = message.get("params").cloned().unwrap_or(Value::Null);
        Some(match method {
            "initialize" => result_reply(id, initialize(&params, self.openui.as_ref())),
            "ping" => result_reply(id, json!({})),
            "tools/list" => result_reply(id, json!({ "tools": self.tool_definitions() })),
            "tools/call" => match self.call_tool(&params) {
                Ok(result) => result_reply(id, result),
                Err((code, message)) => error_reply(id, code, &message),
            },
            _ => error_reply(id, -32601, &format!("method not found: {method}")),
        })
    }

    fn tool_definitions(&self) -> Value {
        let mut tools = tool_definitions();
        if self.openui.is_some() {
            if let Some(list) = tools.as_array_mut() {
                list.extend(OpenUi::tool_definitions());
            }
        }
        tools
    }

    fn call_tool(&self, params: &Value) -> std::result::Result<Value, (i64, String)> {
        let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
        let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
        if let Some(openui) = self.openui.as_ref().filter(|_| OpenUi::handles(name)) {
            // 互动块的两个工具不调后端
            return Ok(openui.call(name, &arguments));
        }
        let run = |work: &dyn Fn(&dyn Transport) -> Value| -> Value {
            match (self.connect)() {
                Ok(transport) => work(transport.as_ref()),
                Err(message) => tool_error(&message),
            }
        };
        match name {
            "revise_translation" => Ok(match ReviseArgs::parse(&arguments) {
                Ok(args) => run(&|transport| revise_translation(transport, &args)),
                Err(message) => tool_error(&message),
            }),
            "view_page" => Ok(match PageArgs::parse(&arguments) {
                Ok(args) => run(&|transport| view_page(transport, &args)),
                Err(message) => tool_error(&message),
            }),
            _ => Err((-32602, format!("unknown tool: {name}"))),
        }
    }
}

fn initialize(params: &Value, openui: Option<&OpenUi>) -> Value {
    let requested = params.get("protocolVersion").and_then(Value::as_str).unwrap_or(PROTOCOL_VERSION);
    let version = if KNOWN_PROTOCOL_VERSIONS.contains(&requested) { requested } else { PROTOCOL_VERSION };
    let instructions = match openui {
        Some(openui) => format!("{INSTRUCTIONS}\n\n{}", openui.intro()),
        None => INSTRUCTIONS.to_string(),
    };
    json!({
        "protocolVersion": version,
        "capabilities": { "tools": { "listChanged": false } },
        "serverInfo": { "name": "retainpdf", "title": "RetainPDF", "version": env!("CARGO_PKG_VERSION") },
        "instructions": instructions,
    })
}

fn result_reply(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn error_reply(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn tool_text(text: &str) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": false })
}

fn tool_error(text: &str) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": true })
}

fn tool_definitions() -> Value {
    json!([
        {
            "name": "revise_translation",
            "title": "改一条译文",
            "description": "改书里一个块的译文，记成 AI 改的（修订历史里能看到、能撤回）。job_id、item_id 照抄书文件夹里块前面的锚点\
<!-- p012-b0003 job=... page=... -->；expected_old_text 填你读到的那句译文，期间被别人改过就不写，回当前译文让你重新判断。\
新译文要过和人工修改同一套检查（公式、术语、占位符），不过就不写，回问题清单。改之前先跟用户说清楚。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "job_id": { "type": "string", "description": "锚点里的 job=…（这一块属于哪个任务）" },
                    "item_id": { "type": "string", "description": "锚点里的块编号，例如 p012-b0003" },
                    "new_text": { "type": "string", "description": "新译文，整块替换；行内公式照原样写 $...$" },
                    "expected_old_text": { "type": "string", "description": "你读到的旧译文（书文件夹里这一块的译文）" },
                    "reason": { "type": "string", "description": "为什么改（一句话，记进修订历史）" }
                },
                "required": ["job_id", "item_id", "new_text", "expected_old_text"],
                "additionalProperties": false
            },
            "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false }
        },
        {
            "name": "view_page",
            "title": "看一页",
            "description": "取一页的图（JPEG）。原文页：side=source，给 document_id 和书的页码 page（锚点里的 page=…）。\
译文页：side=translated，给 job_id 和 item_id（锚点里的，按块所在的页取），或者 job_id 和这个任务自己的页号 page。\
width 是图宽（像素），默认 1000，最大 1600。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "side": { "type": "string", "enum": ["source", "translated"] },
                    "document_id": { "type": "string", "description": "side=source 时必填：书编号（书文件夹 meta.json 里的 document_id）" },
                    "job_id": { "type": "string", "description": "side=translated 时必填：锚点里的 job=…" },
                    "item_id": { "type": "string", "description": "side=translated 时可以给锚点里的块编号，按它所在的页取" },
                    "page": { "type": "integer", "minimum": 1, "description": "source：书的页码；translated：任务自己的页号" },
                    "width": { "type": "integer", "minimum": MIN_PAGE_WIDTH, "maximum": MAX_PAGE_WIDTH }
                },
                "required": ["side"],
                "additionalProperties": false
            },
            "annotations": { "readOnlyHint": true, "openWorldHint": false }
        }
    ])
}

/// 路径里的编号只许字母、数字和 `-_:.`（和后端的条目编号规矩一样），拼进地址前先查，不转义。
fn path_segment(value: &str, what: &str) -> std::result::Result<String, String> {
    let value = value.trim();
    let ok = !value.is_empty()
        && value.len() <= 128
        && value.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | ':' | '.'));
    if ok {
        Ok(value.to_string())
    } else {
        Err(format!("{what} 不对：只能是字母、数字和 - _ : .，1～128 个字符"))
    }
}

fn required_string(arguments: &Value, key: &str) -> std::result::Result<String, String> {
    arguments
        .get(key)
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("缺参数 {key}（字符串）"))
}

struct ReviseArgs {
    job_id: String,
    item_id: String,
    new_text: String,
    expected_old_text: String,
    reason: String,
}

impl ReviseArgs {
    fn parse(arguments: &Value) -> std::result::Result<Self, String> {
        let new_text = required_string(arguments, "new_text")?;
        if new_text.trim().is_empty() {
            return Err("new_text 是空的".into());
        }
        Ok(Self {
            job_id: path_segment(&required_string(arguments, "job_id")?, "job_id")?,
            item_id: path_segment(&required_string(arguments, "item_id")?, "item_id")?,
            new_text,
            expected_old_text: required_string(arguments, "expected_old_text")?,
            reason: arguments.get("reason").and_then(Value::as_str).unwrap_or_default().to_string(),
        })
    }
}

fn revise_translation(transport: &dyn Transport, args: &ReviseArgs) -> Value {
    let path = format!("/api/v1/jobs/{}/translations/{}", args.job_id, args.item_id);
    let body = json!({
        "translated_text": args.new_text,
        "source": "agent",
        "reason": args.reason,
        "expected_translated_text": args.expected_old_text,
    });
    let (status, envelope) = match transport.json("PATCH", &path, Some(&body)) {
        Ok(reply) => reply,
        Err(error) => return tool_error(&format!("{error:#}")),
    };
    let data = &envelope["data"];
    if status == 200 {
        if data["changed"] == json!(false) {
            return tool_text(&format!("{}：新译文和原来一样，没有改动。", args.item_id));
        }
        let mut text = format!(
            "已改好 {}（任务 {}），修订编号 {}。改错了可以在 RetainPDF 的修订历史里撤回。",
            args.item_id,
            args.job_id,
            data["revision"]["revision_id"].as_str().unwrap_or("?")
        );
        let warnings = issue_lines(&data["validation"]["issues"]);
        if !warnings.is_empty() {
            text.push_str("\n检查提示（不挡写入）：\n");
            text.push_str(&warnings);
        }
        return tool_text(&text);
    }
    let details = &envelope["error"]["details"];
    let message = envelope["message"].as_str().unwrap_or("后端拒绝了这次修改");
    let text = match details["reason"].as_str().unwrap_or_default() {
        "text_mismatch" => format!(
            "没有写入：这段译文在你读之后被改过。现在的译文是：\n{}\n请按现在的译文重新判断要不要改。",
            details["current_translated_text"].as_str().unwrap_or("")
        ),
        "validation_failed" => format!(
            "没有写入：新译文没过检查。\n{}",
            issue_lines(&details["validation"]["issues"])
        ),
        "item_not_translatable" => "没有写入：这一块按规则保留原文（公式、代码之类），不能改译文。".to_string(),
        "job_running" => "没有写入：这本书正在翻译或排版，等它跑完再改。".to_string(),
        "read_only_job" | "translations_owned_by_another_job" => format!(
            "没有写入：这个任务的译文不归它自己（{message}）。用锚点里的 job= 那个任务。"
        ),
        "agent_key_not_allowed" | "agent_source_required" => format!("没有写入：AI 专用密钥不允许（{message}）。"),
        _ if status == 404 => format!("没有写入：找不到 {} / {}（{message}）。检查 job_id、item_id 是不是照抄的锚点。", args.job_id, args.item_id),
        _ => format!("没有写入：{message}（HTTP {status}）"),
    };
    tool_error(&text)
}

fn issue_lines(issues: &Value) -> String {
    issues
        .as_array()
        .map(|issues| {
            issues
                .iter()
                .map(|issue| {
                    format!(
                        "- [{}] {}：{}",
                        issue["severity"].as_str().unwrap_or("?"),
                        issue["kind"].as_str().unwrap_or("?"),
                        issue["message"].as_str().unwrap_or("")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

enum PageArgs {
    Source { document_id: String, page: u64, width: u64 },
    Translated { job_id: String, page: u64, width: u64 },
}

/// 块编号 `p012-b0003` 前面的 `p012` 是它在这个任务里的页号。
fn page_of_item(item_id: &str) -> Option<u64> {
    let digits = item_id.strip_prefix('p')?.split('-').next()?;
    digits.parse::<u64>().ok().filter(|page| *page >= 1)
}

impl PageArgs {
    fn parse(arguments: &Value) -> std::result::Result<Self, String> {
        let width = match arguments.get("width") {
            None | Some(Value::Null) => DEFAULT_PAGE_WIDTH,
            Some(value) => value
                .as_u64()
                .filter(|width| (MIN_PAGE_WIDTH..=MAX_PAGE_WIDTH).contains(width))
                .ok_or_else(|| format!("width 要是 {MIN_PAGE_WIDTH}～{MAX_PAGE_WIDTH} 的整数"))?,
        };
        let page = match arguments.get("page") {
            None | Some(Value::Null) => None,
            Some(value) => Some(value.as_u64().filter(|page| *page >= 1).ok_or("page 要是从 1 开始的整数")?),
        };
        match arguments.get("side").and_then(Value::as_str) {
            Some("source") => Ok(Self::Source {
                document_id: path_segment(&required_string(arguments, "document_id")?, "document_id")?,
                page: page.ok_or("side=source 要给 page（书的页码）")?,
                width,
            }),
            Some("translated") => {
                let job_id = path_segment(&required_string(arguments, "job_id")?, "job_id")?;
                let page = match (page, arguments.get("item_id").and_then(Value::as_str)) {
                    (Some(page), _) => page,
                    (None, Some(item_id)) => page_of_item(item_id.trim())
                        .ok_or_else(|| format!("item_id {item_id} 看不出页号（应该像 p012-b0003）"))?,
                    (None, None) => return Err("side=translated 要给 item_id 或 page".into()),
                };
                Ok(Self::Translated { job_id, page, width })
            }
            _ => Err("side 要是 source（原文页）或 translated（译文页）".into()),
        }
    }
}

fn view_page(transport: &dyn Transport, args: &PageArgs) -> Value {
    let (path, label) = match args {
        PageArgs::Source { document_id, page, width } => (
            format!("/api/v1/documents/{document_id}/files/pages/{page}.jpg?width={width}"),
            format!("书 {document_id} 原文第 {page} 页"),
        ),
        PageArgs::Translated { job_id, page, width } => (
            format!("/api/v1/jobs/{job_id}/files/pages/{page}.jpg?width={width}"),
            format!("任务 {job_id} 译文第 {page} 页"),
        ),
    };
    match transport.bytes(&path) {
        Ok((200, bytes)) => json!({
            "content": [
                { "type": "image", "data": base64::engine::general_purpose::STANDARD.encode(&bytes), "mimeType": "image/jpeg" },
                { "type": "text", "text": label }
            ],
            "isError": false
        }),
        Ok((status, bytes)) => {
            let envelope: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
            let message = envelope["message"].as_str().unwrap_or("取不到这一页");
            let hint = match envelope["error"]["details"]["reason"].as_str() {
                Some("not_ready") => "这一页还没排好（任务还在跑，或没有译文 PDF）。",
                _ if status == 404 => "没有这一页或这本书 / 任务；检查编号和页码。",
                _ => "",
            };
            tool_error(&format!("{label}：{message}（HTTP {status}）{hint}"))
        }
        Err(error) => tool_error(&format!("{error:#}")),
    }
}

#[cfg(test)]
#[path = "mcp_tests.rs"]
mod tests;
