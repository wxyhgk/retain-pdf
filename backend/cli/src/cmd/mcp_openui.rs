//! `retainpdf mcp` 的互动块（OpenUI，2026-11-26）：本机 agent（Claude Code、Codex……）在阅读页提问时，桥在 `session/new`
//! 补的这个 MCP 的 `env` 里给说明文件和检查器的位置（`RETAIN_OPENUI_PROMPT`、`RETAIN_OPENUI_LIBRARY`、`RETAIN_OPENUI_CHECK`、
//! `RETAIN_OPENUI_NODE`，见 `retainpdf-providers` 的 `acp/openui.rs`）。给了才开：MCP 的 `instructions` 接上 L0，多两个工具；
//! 用户自己在终端里配的 `retainpdf mcp` 没有这些变量，照旧只有书库的两个工具。
//!
//! 两个工具的语义和 Python 自带 agent（`backend/ask-agent/retainpdf_ask_agent/openui.py`）、pi 扩展一样：
//! - `openui_spec(sections)`：按给的顺序取各段（去重）拼起来；不认识的 id 回可取的列表。
//! - `openui_check(program)`：起 `node backend/openui-check/bin/openui-check.mjs --library …`，回它拼好的 `text`。
//!   显式设 `OPENUI_TELEMETRY_DISABLED=1`、`DO_NOT_TRACK=1`，去掉 `OPENUI_RUNTIME_TELEMETRY_ENABLED`；有超时、输出上限、程序长度上限。
//! 不调后端，不用密钥。方案：docs/ops/planning/reader-ask/20261126-互动块后端实现.md。

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

use serde_json::{json, Value};

pub const ENV_PROMPT: &str = "RETAIN_OPENUI_PROMPT";
pub const ENV_LIBRARY: &str = "RETAIN_OPENUI_LIBRARY";
pub const ENV_CHECK: &str = "RETAIN_OPENUI_CHECK";
pub const ENV_NODE: &str = "RETAIN_OPENUI_NODE";
pub const SPEC_TOOL: &str = "openui_spec";
pub const CHECK_TOOL: &str = "openui_check";
pub const MAX_PROGRAM_CHARS: usize = 40_000;
pub const CHECK_TIMEOUT: Duration = Duration::from_secs(15);
pub const MAX_CHECK_OUTPUT_BYTES: usize = 256 * 1024;
const TELEMETRY_ENV: [(&str, &str); 2] = [("OPENUI_TELEMETRY_DISABLED", "1"), ("DO_NOT_TRACK", "1")];
const TELEMETRY_ENABLE_ENV: &str = "OPENUI_RUNTIME_TELEMETRY_ENABLED";
const UNAVAILABLE_HINT: &str = "这次没法检查：照 openui_spec 取的说明仔细写，写简单些；或者不写互动块，用文字回答。";

struct Section {
    id: String,
    summary: String,
    tokens: Option<u64>,
    text: String,
}

/// 起检查器要的三样。
pub struct Checker {
    pub node: PathBuf,
    pub script: PathBuf,
    pub library: PathBuf,
    pub timeout: Duration,
}

pub struct OpenUi {
    intro: String,
    sections: Vec<Section>,
    checker: Option<Checker>,
    unavailable: String,
}

/// 检查器跑完的样子：退出码和 stdout（最多 `MAX_CHECK_OUTPUT_BYTES + 1` 字节）。
pub enum CheckOutcome {
    Done(Option<i32>, Vec<u8>),
    Timeout,
    Spawn(String),
}

impl OpenUi {
    /// 按桥给的环境变量建；说明文件读不到就 None（不开互动块）。
    pub fn from_env() -> Option<Self> {
        let var = |name: &str| std::env::var(name).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
        let node = var(ENV_NODE).map(PathBuf::from).or_else(find_node_on_path);
        Self::load(Path::new(&var(ENV_PROMPT)?), var(ENV_LIBRARY).map(PathBuf::from), var(ENV_CHECK).map(PathBuf::from), node)
    }

    pub fn load(prompt: &Path, library: Option<PathBuf>, script: Option<PathBuf>, node: Option<PathBuf>) -> Option<Self> {
        let payload: Value = serde_json::from_slice(&std::fs::read(prompt).ok()?).ok()?;
        if payload.get("version").and_then(Value::as_u64) != Some(1) {
            return None;
        }
        let intro = payload.get("intro").and_then(Value::as_str)?.trim().to_string();
        let sections: Vec<Section> = payload
            .get("sections")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some(Section {
                            id: item.get("id").and_then(Value::as_str).filter(|id| !id.is_empty())?.to_string(),
                            summary: item.get("summary").and_then(Value::as_str).unwrap_or_default().to_string(),
                            tokens: item.get("tokens").and_then(Value::as_u64),
                            text: item.get("text").and_then(Value::as_str)?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        if intro.is_empty() || sections.is_empty() {
            return None;
        }
        let present = |path: &Option<PathBuf>| path.as_deref().is_some_and(Path::exists);
        let missing: Vec<&str> = [
            ("组件库 ask-openui-library.v1.json", present(&library)),
            ("openui-check", present(&script)),
            ("Node.js", present(&node)),
        ]
        .into_iter()
        .filter(|(_, ok)| !ok)
        .map(|(label, _)| label)
        .collect();
        let (checker, unavailable) = if missing.is_empty() {
            let checker = Checker {
                node: node.expect("checked"),
                script: script.expect("checked"),
                library: library.expect("checked"),
                timeout: CHECK_TIMEOUT,
            };
            (Some(checker), String::new())
        } else {
            (None, format!("没找到 {}", missing.join("、")))
        };
        Some(Self { intro, sections, checker, unavailable })
    }

    pub fn intro(&self) -> &str {
        &self.intro
    }

    pub fn handles(name: &str) -> bool {
        name == SPEC_TOOL || name == CHECK_TOOL
    }

    pub fn tool_definitions() -> Vec<Value> {
        vec![
            json!({
                "name": SPEC_TOOL,
                "title": "取互动块说明",
                "description": "取写互动块（```openui-lang 代码块）要的说明：按段的 id 取，一次取齐要用的几段（系统提示词「互动块」那段列了可取的段）。\
第一次写一定要取 core。只在能动手的小界面明显比文字清楚时才写互动块；解释一句话、看译文对不对、总结、\
概念问答这类问题用文字回答，不取说明。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "sections": {
                            "type": "array", "items": {"type": "string"}, "minItems": 1,
                            "description": "要取的段的 id，例如 [\"core\", \"components:inputs\", \"functions:builtin\"]"
                        }
                    },
                    "required": ["sections"],
                    "additionalProperties": false
                },
                "annotations": {"readOnlyHint": true, "openWorldHint": false}
            }),
            json!({
                "name": CHECK_TOOL,
                "title": "检查互动块",
                "description": "检查一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）：组件名、参数、没定义或没被引用的名字。\
没错回「没问题。」，有错逐条列出，改完再检查。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "program": {"type": "string", "description": "OpenUI Lang 程序，每行一条 `名字 = 表达式`，有 root = Col([...])"}
                    },
                    "required": ["program"],
                    "additionalProperties": false
                },
                "annotations": {"readOnlyHint": true, "openWorldHint": false}
            }),
        ]
    }

    pub fn call(&self, name: &str, arguments: &Value) -> Value {
        if name == SPEC_TOOL {
            self.spec(arguments.get("sections"))
        } else {
            let runner = self.checker.as_ref().map(|checker| move |program: &str| run_checker(checker, program));
            check_result(runner, arguments.get("program"), CHECK_TIMEOUT, &self.unavailable)
        }
    }

    fn catalog(&self) -> String {
        self.sections
            .iter()
            .map(|section| {
                let tokens = section.tokens.map(|tokens| tokens.to_string()).unwrap_or_else(|| "?".into());
                format!("- `{}`：{}（约 {tokens} token）", section.id, section.summary)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// `openui_spec`。
    pub fn spec(&self, raw: Option<&Value>) -> Value {
        let list: Option<Vec<&str>> = match raw {
            Some(Value::String(one)) => Some(vec![one.as_str()]),
            Some(Value::Array(items)) if !items.is_empty() => items.iter().map(Value::as_str).collect(),
            _ => None,
        };
        let Some(list) = list else {
            return tool_error(&format!("sections 要是段的 id 列表（字符串）。可取的段：\n{}", self.catalog()));
        };
        let mut wanted: Vec<&str> = Vec::new();
        for item in list {
            let key = item.trim();
            if !key.is_empty() && !wanted.contains(&key) {
                wanted.push(key);
            }
        }
        let find = |key: &str| self.sections.iter().find(|section| section.id == key);
        let known: Vec<&Section> = wanted.iter().filter_map(|key| find(key)).collect();
        let unknown: Vec<&str> = wanted.iter().copied().filter(|key| find(key).is_none()).collect();
        let quoted = |keys: &[&str]| keys.iter().map(|key| format!("`{key}`")).collect::<Vec<_>>().join("、");
        if known.is_empty() {
            let named = if unknown.is_empty() { "（空）".to_string() } else { quoted(&unknown) };
            return tool_error(&format!("不认识的段：{named}。可取的段：\n{}", self.catalog()));
        }
        let mut text = known.iter().map(|section| section.text.trim()).collect::<Vec<_>>().join("\n\n");
        if !unknown.is_empty() {
            let ids: Vec<&str> = self.sections.iter().map(|section| section.id.as_str()).collect();
            text.push_str(&format!("\n\n（不认识的段：{}，没有取。可取的段：{}。）", quoted(&unknown), quoted(&ids)));
        }
        tool_text(&text)
    }
}

fn find_node_on_path() -> Option<PathBuf> {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    std::env::split_paths(&std::env::var_os("PATH")?).map(|dir| dir.join(name)).find(|path| path.is_file())
}

/// 起检查器的命令：关掉 lang-core 的遥测。
pub fn checker_command(checker: &Checker) -> Command {
    let mut command = Command::new(&checker.node);
    command.arg(&checker.script).arg("--library").arg(&checker.library);
    for (name, value) in TELEMETRY_ENV {
        command.env(name, value);
    }
    command.env_remove(TELEMETRY_ENABLE_ENV);
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    command
}

/// stdin 写程序，stdout 最多读 `MAX_CHECK_OUTPUT_BYTES + 1` 字节，超时杀掉。
pub fn run_checker(checker: &Checker, program: &str) -> CheckOutcome {
    let mut child = match checker_command(checker).spawn() {
        Ok(child) => child,
        Err(error) => return CheckOutcome::Spawn(error.to_string()),
    };
    let mut stdin = child.stdin.take();
    let input = program.as_bytes().to_vec();
    std::thread::spawn(move || {
        if let Some(stdin) = stdin.as_mut() {
            let _ = stdin.write_all(&input);
        }
    });
    let stdout = child.stdout.take();
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut output = Vec::new();
        if let Some(stdout) = stdout {
            let _ = stdout.take(MAX_CHECK_OUTPUT_BYTES as u64 + 1).read_to_end(&mut output);
        }
        let _ = sender.send(output);
    });
    match receiver.recv_timeout(checker.timeout) {
        Ok(output) => {
            if output.len() > MAX_CHECK_OUTPUT_BYTES {
                let _ = child.kill();
            }
            let code = child.wait().ok().and_then(|status| status.code());
            CheckOutcome::Done(code, output)
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            CheckOutcome::Timeout
        }
    }
}

/// `openui_check`：回检查器拼好的话；用不了、超时、输出不对回一段说明（工具出错）。
pub fn check_result<F: Fn(&str) -> CheckOutcome>(runner: Option<F>, program: Option<&Value>, timeout: Duration, unavailable: &str) -> Value {
    let Some(program) = program.and_then(Value::as_str).filter(|program| !program.trim().is_empty()) else {
        return tool_error("program 要是一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）。");
    };
    let chars = program.chars().count();
    if chars > MAX_PROGRAM_CHARS {
        return tool_error(&format!("程序太长（{chars} 字符，最多 {MAX_PROGRAM_CHARS}）：互动块要小，拆小或删掉用不到的部分。"));
    }
    let Some(runner) = runner else {
        let reason = if unavailable.is_empty() { "没配好 openui-check" } else { unavailable };
        return tool_error(&format!("检查器用不了（{reason}）。{UNAVAILABLE_HINT}"));
    };
    let (code, output) = match runner(program) {
        CheckOutcome::Done(code, output) => (code, output),
        CheckOutcome::Timeout => return tool_error(&format!("检查超时（{} 秒）。{UNAVAILABLE_HINT}", timeout.as_secs_f64())),
        CheckOutcome::Spawn(message) => return tool_error(&format!("检查器起不来（Node.js：{message}）。{UNAVAILABLE_HINT}")),
    };
    let code = code.map(|code| code.to_string()).unwrap_or_else(|| "None".into());
    if output.len() > MAX_CHECK_OUTPUT_BYTES {
        return tool_error(&format!("检查器的输出太大（超过 {MAX_CHECK_OUTPUT_BYTES} 字节）。{UNAVAILABLE_HINT}"));
    }
    let text = String::from_utf8_lossy(&output);
    let Some(payload) = text.trim().lines().last().and_then(|line| serde_json::from_str::<Value>(line).ok()) else {
        return tool_error(&format!("检查器没有回结果（退出码 {code}）。{UNAVAILABLE_HINT}"));
    };
    if !payload.is_object() {
        return tool_error(&format!("检查器回的不是结果（退出码 {code}）。{UNAVAILABLE_HINT}"));
    }
    if let Some(fatal) = payload.get("fatal").filter(|fatal| !fatal.is_null() && *fatal != &json!(false)) {
        let fatal: String = fatal.as_str().map(str::to_string).unwrap_or_else(|| fatal.to_string()).chars().take(500).collect();
        return tool_error(&format!("检查器用不了：{fatal}。{UNAVAILABLE_HINT}"));
    }
    let ok = payload.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let text = payload
        .get("text")
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| if ok { "没问题。".into() } else { "有问题，但检查器没说是什么。".into() });
    // 检查出了问题不算工具出错，问题在 text 里
    tool_text(&text)
}

fn tool_text(text: &str) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": false })
}

fn tool_error(text: &str) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": true })
}
