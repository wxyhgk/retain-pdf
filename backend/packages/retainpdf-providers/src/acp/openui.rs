//! 回答里的互动块（OpenUI，2026-11-26）：桥告诉三类 agent 说明文件和检查器在哪。
//! 方案：docs/ops/planning/reader-ask/20261126-互动块后端实现.md（需求是前端写的 20261126-互动块分层提示词.md）。
//!
//! - 说明文件在 `contracts/openui/`（前端生成、后端只读）：`ask-openui-prompt.v1.json`（L0 `intro` 和分层的 `sections`）、
//!   `ask-openui-library.v1.json`（组件库的 JSON 规格）。位置：`RUST_API_OPENUI_DIR`，没设就是 `<项目根>/contracts/openui`。
//! - 检查器是后端自己的 Node 包 `backend/openui-check`（`@openuidev/lang-core` 1.2.0），入口 `bin/openui-check.mjs`。
//!   位置：`RUST_API_OPENUI_CHECK_DIR`，没设就是 `<项目根>/backend/openui-check`；依赖没装（没有 `node_modules/@openuidev/lang-core`）
//!   照样告诉 agent，`openui_check` 会回「检查器用不了」。
//! - Node：和代装一样，先找 `RUST_API_NODE_DIR`（桌面版自带的 Node），没有用 PATH 上的；都没有就不给 `RETAIN_OPENUI_NODE`
//!   （Python 自带 agent 再找一次 PATH，pi 用跑它自己的 node，`retainpdf mcp` 也找 PATH）。
//!
//! 给 agent 的环境变量（[`openui_env`]）：`RETAIN_OPENUI_PROMPT`、`RETAIN_OPENUI_LIBRARY`、`RETAIN_OPENUI_CHECK`、`RETAIN_OPENUI_NODE`。
//! 自带 `retainpdf`（Python）和 `retainpdf-pi` 进程环境里给；本机 agent 经补进 `session/new` 的 `retainpdf mcp` 的 `env` 给。
//! pi 的 L0 由桥写进私有配置目录的一个文件（[`write_intro`]），包装脚本用 `--append-system-prompt` 接上。
//! 说明文件读不到就什么都不给，agent 照常回答（不开互动块）。
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::install::node_bin_dir;
use super::registry::find_in_path;
use super::AcpConfig;

pub const OPENUI_DIR_ENV: &str = "RUST_API_OPENUI_DIR";
pub const OPENUI_CHECK_DIR_ENV: &str = "RUST_API_OPENUI_CHECK_DIR";
pub const PROMPT_FILE: &str = "ask-openui-prompt.v1.json";
pub const LIBRARY_FILE: &str = "ask-openui-library.v1.json";
/// 相对检查器包的目录。
pub const CHECK_SCRIPT: &str = "bin/openui-check.mjs";

pub const ENV_PROMPT: &str = "RETAIN_OPENUI_PROMPT";
pub const ENV_LIBRARY: &str = "RETAIN_OPENUI_LIBRARY";
pub const ENV_CHECK: &str = "RETAIN_OPENUI_CHECK";
pub const ENV_NODE: &str = "RETAIN_OPENUI_NODE";
/// pi 的包装脚本读：L0 的文件（桥写在这次连接的私有配置目录里）。
pub const ENV_PI_INTRO: &str = "RETAIN_PI_OPENUI_INTRO";
pub const PI_INTRO_FILE: &str = "openui-intro.md";

/// 说明文件的目录：`RUST_API_OPENUI_DIR`，没设就是 `<项目根>/contracts/openui`。rust_api 建 [`AcpConfig`] 时调。
pub fn default_openui_dir(env_value: Option<&std::ffi::OsStr>, project_root: &Path) -> Option<PathBuf> {
    pick_dir(env_value, project_root.join("contracts").join("openui"))
}

/// 检查器包的目录：`RUST_API_OPENUI_CHECK_DIR`，没设就是 `<项目根>/backend/openui-check`。
pub fn default_openui_check_dir(env_value: Option<&std::ffi::OsStr>, project_root: &Path) -> Option<PathBuf> {
    pick_dir(env_value, project_root.join("backend").join("openui-check"))
}

fn pick_dir(env_value: Option<&std::ffi::OsStr>, fallback: PathBuf) -> Option<PathBuf> {
    let dir = env_value.filter(|value| !value.is_empty()).map(PathBuf::from).unwrap_or(fallback);
    dir.is_dir().then_some(dir)
}

/// 起 openui-check 用的 node：`RUST_API_NODE_DIR` 里的，没有就 PATH 上的。
pub(super) fn find_node(config: &AcpConfig) -> Option<PathBuf> {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    if let Some(dir) = config.node_dir.as_deref() {
        let node = node_bin_dir(dir).join(name);
        if node.is_file() {
            return Some(node);
        }
    }
    find_in_path(name, config.path_var.as_deref())
}

/// 说明文件在不在（读得到、是 v1、有 `intro`）：在就返回 L0。
pub(super) fn intro(config: &AcpConfig) -> Option<String> {
    let path = config.openui_dir.as_deref()?.join(PROMPT_FILE);
    let payload: Value = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
    if payload.get("version").and_then(Value::as_u64) != Some(1) {
        return None;
    }
    let intro = payload.get("intro").and_then(Value::as_str)?.trim();
    (!intro.is_empty()).then(|| intro.to_string())
}

/// 给 agent 的环境变量。说明文件读不到就是空的（不开互动块）。
pub(super) fn openui_env(config: &AcpConfig) -> Vec<(String, String)> {
    let Some(dir) = config.openui_dir.as_deref() else {
        return Vec::new();
    };
    if intro(config).is_none() {
        return Vec::new();
    }
    let path = |path: &Path| path.to_string_lossy().into_owned();
    let mut env = vec![(ENV_PROMPT.to_string(), path(&dir.join(PROMPT_FILE))), (ENV_LIBRARY.to_string(), path(&dir.join(LIBRARY_FILE)))];
    if let Some(check_dir) = config.openui_check_dir.as_deref() {
        env.push((ENV_CHECK.to_string(), path(&check_dir.join(CHECK_SCRIPT))));
    }
    if let Some(node) = find_node(config) {
        env.push((ENV_NODE.to_string(), path(&node)));
    }
    env
}

/// pi：把 L0 写进这次连接的私有配置目录，返回包装脚本要的环境变量。说明文件读不到就不写。
pub(super) fn write_intro(config: &AcpConfig, agent_dir: &Path) -> std::io::Result<Vec<(String, String)>> {
    let Some(text) = intro(config) else {
        return Ok(Vec::new());
    };
    let file = agent_dir.join(PI_INTRO_FILE);
    std::fs::write(&file, text)?;
    Ok(vec![(ENV_PI_INTRO.to_string(), file.to_string_lossy().into_owned())])
}
