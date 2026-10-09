//! 终端输出与提问。

use std::io::{self, BufRead, IsTerminal, Write};

use anyhow::{bail, Result};
use serde_json::Value;

pub fn print_json(value: &Value) {
    println!("{}", serde_json::to_string_pretty(value).unwrap_or_default());
}

pub fn ok(text: impl AsRef<str>) {
    println!("✓ {}", text.as_ref());
}

pub fn warn(text: impl AsRef<str>) {
    println!("! {}", text.as_ref());
}

pub fn bad(text: impl AsRef<str>) {
    println!("✗ {}", text.as_ref());
}

pub fn human_bytes(bytes: u64) -> String {
    let value = bytes as f64;
    if value >= 1024.0 * 1024.0 * 1024.0 {
        format!("{:.1} GB", value / 1024.0 / 1024.0 / 1024.0)
    } else if value >= 1024.0 * 1024.0 {
        format!("{:.1} MB", value / 1024.0 / 1024.0)
    } else if value >= 1024.0 {
        format!("{:.0} KB", value / 1024.0)
    } else {
        format!("{bytes} B")
    }
}

/// 能不能一问一答(标准输入是终端)。
pub fn interactive() -> bool {
    io::stdin().is_terminal()
}

fn require_terminal() -> Result<()> {
    if !interactive() {
        bail!("这一步要在终端里回答问题;在脚本里请改用带参数的写法(见 --help)");
    }
    Ok(())
}

/// 问一句;直接回车用默认值。
pub fn ask(label: &str, default: &str) -> Result<String> {
    require_terminal()?;
    if default.is_empty() {
        print!("{label}:");
    } else {
        print!("{label} [{default}]:");
    }
    io::stdout().flush()?;
    let mut line = String::new();
    io::stdin().lock().read_line(&mut line)?;
    let answer = line.trim();
    Ok(if answer.is_empty() { default.to_string() } else { answer.to_string() })
}

/// 问密钥(输入不回显);直接回车为空串。
pub fn ask_secret(label: &str) -> Result<String> {
    require_terminal()?;
    Ok(rpassword::prompt_password(format!("{label}:"))?.trim().to_string())
}

/// 问是否继续;默认否。
pub fn confirm(question: &str) -> Result<bool> {
    require_terminal()?;
    print!("{question} [y/N]:");
    io::stdout().flush()?;
    let mut line = String::new();
    io::stdin().lock().read_line(&mut line)?;
    Ok(matches!(line.trim().to_ascii_lowercase().as_str(), "y" | "yes" | "是"))
}
