//! `retainpdf backup`:书库数据库的备份与恢复。后端开着时经后端(恢复时它会停住同步、
//! 拒绝在任务运行时恢复),没开时直接操作数据目录(规则相同,见 retain-db 的 backup.rs)。

use std::process::ExitCode;

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::{json, Value};

use retain_data::db::backup::{KIND_BEFORE_RESTORE, KIND_MANUAL};

use crate::context::Ctx;
use crate::ui;

#[derive(Subcommand)]
pub enum BackupCommand {
    /// 列出备份(新的在前)
    List,
    /// 立即备份一份
    Create,
    /// 用一份备份替换当前书库(先自动存一份恢复前的);<备份> 是编号或列表里的序号
    Restore {
        backup: String,
        /// 不问,直接恢复
        #[arg(long)]
        yes: bool,
    },
    /// 删掉一份备份
    Delete { backup: String },
}

fn kind_label(kind: &str) -> &str {
    match kind {
        "auto" => "自动",
        "manual" => "手动",
        "before-restore" => "恢复前",
        "before-upgrade" => "升级前",
        other => other,
    }
}

/// 备份列表(与 GET /api/v1/backups 的 items 同形状)。
fn list(ctx: &Ctx) -> Result<Vec<Value>> {
    if let Some(backend) = ctx.writer()? {
        let status = backend.get("/api/v1/backups")?;
        return Ok(status.get("items").and_then(Value::as_array).cloned().unwrap_or_default());
    }
    let db = ctx.db()?;
    Ok(db
        .list_backups()?
        .into_iter()
        .map(|b| json!({
            "id": b.id, "kind": b.kind, "created_at": b.created_at.to_rfc3339(),
            "schema_version": b.schema_version, "bytes": b.bytes,
        }))
        .collect())
}

/// 编号,或列表里的序号(1 是最新的)。
fn resolve(ctx: &Ctx, given: &str) -> Result<String> {
    let items = list(ctx)?;
    if let Ok(index) = given.parse::<usize>() {
        if let Some(item) = index.checked_sub(1).and_then(|i| items.get(i)) {
            return Ok(item["id"].as_str().unwrap_or_default().to_string());
        }
    }
    if items.iter().any(|b| b["id"] == given) {
        return Ok(given.to_string());
    }
    bail!("没有这份备份:{given}(`retainpdf backup list` 看编号)")
}

pub fn run(ctx: &Ctx, action: BackupCommand) -> Result<ExitCode> {
    match action {
        BackupCommand::List => {
            let items = list(ctx)?;
            if ctx.json {
                ui::print_json(&json!(items));
            } else if items.is_empty() {
                println!("还没有备份。`retainpdf backup create` 立即备份一份");
            } else {
                for (i, item) in items.iter().enumerate() {
                    let when: String = item["created_at"].as_str().unwrap_or("").replace('T', " ").chars().take(19).collect();
                    println!(
                        "{:>3}. {when}  {:<4}  {:>8}  {}",
                        i + 1,
                        kind_label(item["kind"].as_str().unwrap_or("")),
                        ui::human_bytes(item["bytes"].as_u64().unwrap_or(0)),
                        item["id"].as_str().unwrap_or("")
                    );
                }
            }
        }
        BackupCommand::Create => {
            let made = match ctx.writer()? {
                Some(backend) => backend.post("/api/v1/backups", None)?,
                None => {
                    let db = ctx.db()?;
                    let info = db.create_backup(KIND_MANUAL)?;
                    db.prune_backups()?;
                    json!({ "id": info.id, "kind": info.kind, "bytes": info.bytes })
                }
            };
            if ctx.json {
                ui::print_json(&made);
            } else {
                ui::ok(format!(
                    "已备份 {}({})",
                    made["id"].as_str().unwrap_or(""),
                    ui::human_bytes(made["bytes"].as_u64().unwrap_or(0))
                ));
            }
        }
        BackupCommand::Restore { backup, yes } => {
            let id = resolve(ctx, &backup)?;
            if !yes {
                if !ui::interactive() {
                    bail!("恢复会替换当前书库;在脚本里请加 --yes");
                }
                if !ui::confirm(&format!("书库会回到 {id} 那一刻(当前的先自动备份一份),继续吗?"))? {
                    println!("没有恢复");
                    return Ok(ExitCode::SUCCESS);
                }
            }
            let result = match ctx.writer()? {
                Some(backend) => backend.post(&format!("/api/v1/backups/{id}/restore"), None)?,
                None => {
                    let db = ctx.db()?;
                    let blockers = db.restore_blockers()?;
                    if !blockers.is_empty() {
                        bail!("{},等它们结束后再恢复", blockers.join(","));
                    }
                    let safety = db.create_backup(KIND_BEFORE_RESTORE)?;
                    if let Err(refusal) = db.restore_backup(&id)? {
                        bail!("{refusal}");
                    }
                    db.prune_backups()?;
                    json!({ "restored": id, "safety_backup": safety.id })
                }
            };
            if ctx.json {
                ui::print_json(&result);
            } else {
                ui::ok(format!("已恢复到 {}", result["restored"].as_str().unwrap_or(&id)));
                println!("  恢复前的书库存成了 {},恢复错了可以再恢复它", result["safety_backup"].as_str().unwrap_or(""));
            }
        }
        BackupCommand::Delete { backup } => {
            let id = resolve(ctx, &backup)?;
            match ctx.writer()? {
                Some(backend) => {
                    backend.call(reqwest::Method::DELETE, &format!("/api/v1/backups/{id}"), None)?;
                }
                None => {
                    ctx.db()?.delete_backup(&id)?;
                }
            }
            if ctx.json {
                ui::print_json(&json!({ "ok": true, "deleted": id }));
            } else {
                ui::ok(format!("已删除 {id}"));
            }
        }
    }
    Ok(ExitCode::SUCCESS)
}
