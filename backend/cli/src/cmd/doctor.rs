//! `retainpdf doctor`:逐项检查,告诉你哪里不对、怎么改。

use std::process::ExitCode;

use anyhow::Result;
use serde_json::{json, Value};

use super::status::{sync_summary, backups};
use crate::context::{BackendState, Ctx};
use crate::ui;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Level {
    Ok,
    Warn,
    Bad,
}

struct Check {
    name: &'static str,
    level: Level,
    detail: String,
}

fn check(name: &'static str, level: Level, detail: impl Into<String>) -> Check {
    Check { name, level, detail: detail.into() }
}

/// 数据目录所在磁盘的剩余空间(字节);拿不到为 None。
fn free_space(path: &std::path::Path) -> Option<u64> {
    let output = std::process::Command::new("df").args(["-Pk"]).arg(path).output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().nth(1)?;
    let available: u64 = line.split_whitespace().nth(3)?.parse().ok()?;
    Some(available * 1024)
}

fn hours_since(iso: &str) -> Option<i64> {
    let at = chrono_like_parse(iso)?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).ok()?.as_secs() as i64;
    Some((now - at) / 3600)
}

/// RFC 3339 -> Unix 秒(只认 `YYYY-MM-DDTHH:MM:SS` 开头,时区按偏移算)。
fn chrono_like_parse(iso: &str) -> Option<i64> {
    let parsed = chrono::DateTime::parse_from_rfc3339(iso).ok()?;
    Some(parsed.timestamp())
}

pub fn run(ctx: &Ctx) -> Result<ExitCode> {
    let mut checks = Vec::new();

    // 配置。
    match ctx.settings() {
        Ok(settings) => {
            checks.push(check("配置文件", Level::Ok, ctx.home.dir().display().to_string()));
            checks.push(match &settings.translation.api_key {
                Some(_) => check("翻译 API Key", Level::Ok, format!("{} · {}", settings.translation.provider, settings.translation.model)),
                None => check(
                    "翻译 API Key",
                    Level::Bad,
                    format!("没填。运行 `retainpdf setup`,或 `retainpdf config set providers.{}.api_key`", settings.translation.provider),
                ),
            });
            if settings.translation.base_url.is_empty() {
                checks.push(check("翻译接口地址", Level::Bad, "自定义服务商要填 providers.custom.base_url"));
            }
            checks.push(match &settings.ocr_token {
                Some(_) => check("OCR token", Level::Ok, settings.ocr_provider.clone()),
                None => check("OCR token", Level::Bad, format!("没填({})。运行 `retainpdf setup`", settings.ocr_provider)),
            });
        }
        Err(error) => checks.push(check("配置文件", Level::Bad, format!("{error:#}"))),
    }

    // 数据目录与磁盘。
    if ctx.data_dir.is_dir() {
        let probe = ctx.data_dir.join(format!(".doctor-{}", std::process::id()));
        let writable = std::fs::write(&probe, b"ok").is_ok();
        let _ = std::fs::remove_file(&probe);
        checks.push(if writable {
            check("数据目录", Level::Ok, ctx.data_dir.display().to_string())
        } else {
            check("数据目录", Level::Bad, format!("{} 写不进去", ctx.data_dir.display()))
        });
        if let Some(free) = free_space(&ctx.data_dir) {
            let level = if free < 2 << 30 { Level::Bad } else if free < 10 << 30 { Level::Warn } else { Level::Ok };
            checks.push(check("磁盘空间", level, format!("剩 {}", ui::human_bytes(free))));
        }
    } else {
        checks.push(check("数据目录", Level::Warn, format!("{} 还不存在(还没打开过 RetainPDF?)", ctx.data_dir.display())));
    }

    // 数据库。
    if let Some(conn) = ctx.read_db()? {
        // 完整性检查要可写的连接(全文索引的检查会写临时数据),不改书库内容。
        let result: String = rusqlite::Connection::open(ctx.db_path())
            .and_then(|rw| {
                rw.busy_timeout(std::time::Duration::from_secs(5))?;
                rw.query_row("PRAGMA quick_check", [], |row| row.get(0))
            })
            .unwrap_or_else(|e| e.to_string());
        checks.push(if result == "ok" {
            check("数据库", Level::Ok, "完整性检查通过")
        } else {
            check("数据库", Level::Bad, format!("完整性检查没通过:{result}。可以 `retainpdf backup list` 找一份备份恢复"))
        });
        let sync = sync_summary(&conn);
        if sync["enabled"].as_bool() == Some(true) {
            let last = &sync["last_run"];
            checks.push(match last.get("ok").and_then(Value::as_bool) {
                Some(true) => check("同步", Level::Ok, format!("等待 {} 项", sync["pending"])),
                Some(false) => check("同步", Level::Bad, last.get("error").and_then(Value::as_str).unwrap_or("上次同步出错").to_string()),
                None => check("同步", Level::Warn, "开着,还没同步过"),
            });
        }
    }

    // 备份。
    let backup = backups(ctx);
    checks.push(match backup["last_auto"].as_str().and_then(hours_since) {
        Some(hours) if hours <= 48 => check("自动备份", Level::Ok, format!("{hours} 小时前")),
        Some(hours) => check("自动备份", Level::Warn, format!("最近一次是 {} 天前(后端开着时每天备份)", hours / 24)),
        None if ctx.db_path().is_file() => check("自动备份", Level::Warn, "还没有。后端开着时会每天自动备份,也可以 `retainpdf backup create`"),
        None => check("自动备份", Level::Ok, "还没有书库,不需要"),
    });

    // 后端。
    match &ctx.backend {
        BackendState::Running(backend) => match backend.ready() {
            Ok(ready) if ready.get("status").and_then(Value::as_str) == Some("ready") => {
                checks.push(check("后端", Level::Ok, backend.runtime.api_base.clone()))
            }
            Ok(ready) => checks.push(check(
                "后端",
                Level::Bad,
                format!("没准备好:{}", ready.get("reasons").map(|r| r.to_string()).unwrap_or_default()),
            )),
            Err(error) => checks.push(check("后端", Level::Bad, format!("{error:#}"))),
        },
        BackendState::Unreachable(runtime) => {
            checks.push(check("后端", Level::Bad, format!("进程 {} 在,但连不上 {}", runtime.pid, runtime.api_base)))
        }
        BackendState::Stopped => checks.push(check("后端", Level::Warn, "没在运行(翻译、下载要先打开 RetainPDF)")),
    }

    let worst = checks.iter().map(|c| c.level).fold(Level::Ok, |a, b| match (a, b) {
        (Level::Bad, _) | (_, Level::Bad) => Level::Bad,
        (Level::Warn, _) | (_, Level::Warn) => Level::Warn,
        _ => Level::Ok,
    });
    if ctx.json {
        let items: Vec<Value> = checks
            .iter()
            .map(|c| json!({
                "check": c.name,
                "level": match c.level { Level::Ok => "ok", Level::Warn => "warn", Level::Bad => "bad" },
                "detail": c.detail,
            }))
            .collect();
        ui::print_json(&json!({ "ok": worst != Level::Bad, "checks": items }));
    } else {
        for c in &checks {
            let line = format!("{}:{}", c.name, c.detail);
            match c.level {
                Level::Ok => ui::ok(line),
                Level::Warn => ui::warn(line),
                Level::Bad => ui::bad(line),
            }
        }
    }
    Ok(if worst == Level::Bad { ExitCode::from(2) } else { ExitCode::SUCCESS })
}
