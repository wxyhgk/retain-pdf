//! `retainpdf status`:后端、数据目录、书库、同步、备份的概况。只读,后端开不开都能用。

use std::path::Path;
use std::process::ExitCode;

use anyhow::Result;
use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};

use crate::context::{BackendState, Ctx};
use crate::ui;
use retain_data::db::Db;

pub fn dir_size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| match entry.file_type() {
            Ok(kind) if kind.is_dir() => dir_size(&entry.path()),
            Ok(kind) if kind.is_file() => entry.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

fn count(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap_or(0)
}

pub fn sync_state(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM sync_state WHERE key = ?1", [key], |row| row.get::<_, String>(0))
        .optional()
        .ok()
        .flatten()
        .filter(|v| !v.is_empty())
}

pub fn library(conn: &Connection) -> Value {
    json!({
        "books": count(conn, "SELECT COUNT(*) FROM documents"),
        "jobs": count(conn, "SELECT COUNT(*) FROM jobs"),
        "running_jobs": count(conn, "SELECT COUNT(*) FROM jobs WHERE status_json IN ('\"queued\"', '\"running\"')"),
        "failed_jobs": count(conn, "SELECT COUNT(*) FROM jobs WHERE status_json = '\"failed\"'"),
    })
}

pub fn sync_summary(conn: &Connection) -> Value {
    let parse = |key: &str| sync_state(conn, key).and_then(|j| serde_json::from_str::<Value>(&j).ok());
    json!({
        "enabled": sync_state(conn, "enabled").as_deref() == Some("1"),
        "transport": sync_state(conn, "transport").unwrap_or_else(|| "folder".into()),
        "location": sync_state(conn, "webdav_url").filter(|_| sync_state(conn, "transport").as_deref() == Some("webdav"))
            .or_else(|| sync_state(conn, "folder")),
        "last_run": parse("last_run"),
        "last_maintenance": parse("last_maintenance"),
        "pending": count(conn, "SELECT COUNT(*) FROM sync_pending"),
    })
}

pub fn backups(ctx: &Ctx) -> Value {
    let db = Db::new(ctx.db_path(), ctx.data_dir.clone());
    let list = db.list_backups().unwrap_or_default();
    json!({
        "count": list.len(),
        "latest": list.first().map(|b| b.created_at.to_rfc3339()),
        "last_auto": list.iter().find(|b| b.kind == "auto").map(|b| b.created_at.to_rfc3339()),
        "dir": db.backups_dir(),
    })
}

pub fn backend_summary(ctx: &Ctx) -> Value {
    match &ctx.backend {
        BackendState::Stopped => json!({ "state": "stopped" }),
        BackendState::Unreachable(r) => json!({ "state": "unreachable", "api_base": r.api_base, "pid": r.pid }),
        BackendState::Running(b) => json!({
            "state": "running",
            "api_base": b.runtime.api_base,
            "pid": b.runtime.pid,
            "health": b.health().ok(),
        }),
    }
}

fn short_time(iso: Option<&str>) -> String {
    iso.map(|t| t.replace('T', " ").chars().take(16).collect()).unwrap_or_else(|| "从未".into())
}

pub fn run(ctx: &Ctx) -> Result<ExitCode> {
    let settings = ctx.settings();
    let conn = ctx.read_db()?;
    let report = json!({
        "config_dir": ctx.home.dir(),
        "data_dir": ctx.data_dir,
        "data_exists": ctx.data_dir.is_dir(),
        "data_bytes": dir_size(&ctx.data_dir),
        "backend": backend_summary(ctx),
        "translation": settings.as_ref().ok().map(|s| json!({
            "provider": s.translation.provider, "model": s.translation.model,
            "protocol": s.translation.protocol, "thinking": s.translation.thinking,
            "workers": s.translation.workers, "api_key": s.translation.api_key.is_some(),
        })),
        "ocr": settings.as_ref().ok().map(|s| json!({ "provider": s.ocr_provider, "token": s.ocr_token.is_some() })),
        "config_error": settings.as_ref().err().map(|e| format!("{e:#}")),
        "library": conn.as_ref().map(library),
        "sync": conn.as_ref().map(sync_summary),
        "backups": backups(ctx),
    });
    if ctx.json {
        ui::print_json(&report);
        return Ok(ExitCode::SUCCESS);
    }
    match &ctx.backend {
        BackendState::Running(b) => {
            let health = b.health().ok();
            let queue = health.as_ref().and_then(|h| h.get("queue_depth")).and_then(Value::as_i64).unwrap_or(0);
            let running = health.as_ref().and_then(|h| h.get("running_jobs")).and_then(Value::as_i64).unwrap_or(0);
            println!("后端      运行中 {}(进程 {}),运行 {running} 个任务,排队 {queue} 个", b.runtime.api_base, b.runtime.pid);
        }
        BackendState::Unreachable(r) => println!("后端      进程 {} 在,但连不上 {}", r.pid, r.api_base),
        BackendState::Stopped => println!("后端      没在运行"),
    }
    if ctx.data_dir.is_dir() {
        println!("数据目录  {}({})", ctx.data_dir.display(), ui::human_bytes(report["data_bytes"].as_u64().unwrap_or(0)));
    } else {
        println!("数据目录  {}(还不存在)", ctx.data_dir.display());
    }
    if let Some(lib) = report["library"].as_object() {
        println!(
            "书库      {} 本书,{} 个任务(运行或排队 {},失败 {})",
            lib["books"], lib["jobs"], lib["running_jobs"], lib["failed_jobs"]
        );
    }
    match &settings {
        Ok(s) => {
            let key = if s.translation.api_key.is_some() { "已填 API Key" } else { "没填 API Key" };
            println!(
                "翻译      {} · {} · {} 协议 · 思考 {} · 并发 {} · {key}",
                s.translation.provider, s.translation.model, s.translation.protocol, s.translation.thinking, s.translation.workers
            );
            let token = if s.ocr_token.is_some() { "已填 token" } else { "没填 token" };
            println!("OCR       {} · {token}", s.ocr_provider);
        }
        Err(error) => println!("配置      读不了:{error:#}"),
    }
    if let Some(sync) = report["sync"].as_object() {
        if sync["enabled"].as_bool() == Some(true) {
            let last = &sync["last_run"];
            let when = short_time(last.get("finished_at").and_then(Value::as_str));
            let result = if last.get("ok").and_then(Value::as_bool) == Some(false) { "出错" } else { "成功" };
            println!(
                "同步      开着 · {} · 上次 {when} {result} · 等待 {} 项",
                sync["location"].as_str().unwrap_or("未配置"),
                sync["pending"]
            );
        } else {
            println!("同步      没开");
        }
    }
    let backups = &report["backups"];
    println!(
        "备份      {} 份 · 最近一次自动备份 {}",
        backups["count"],
        short_time(backups["last_auto"].as_str())
    );
    Ok(ExitCode::SUCCESS)
}
