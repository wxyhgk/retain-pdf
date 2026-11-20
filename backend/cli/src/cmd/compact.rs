//! `retainpdf compact`：整理书库数据库、把空间还给磁盘（2026-11-20 数据库瘦身）。只在后端没开时用。
//!
//! 先备份一份，再：截短老任务存下的程序输出（完整的在任务目录 logs/ 下）、`--drop-events` 给的已结束任务的进度事件
//! 提前到期、整库压缩并切到增量收缩模式（之后 30 天清理删掉的空间会自动还回来）。压缩时临时要再占一份库那么大的磁盘。

use std::process::ExitCode;

use anyhow::{bail, Result};
use clap::Args;
use serde_json::json;

use retainpdf_data::db::backup::KIND_MANUAL;

use crate::context::Ctx;
use crate::ui;

#[derive(Args)]
pub struct CompactArgs {
    /// 这个已结束任务的进度事件现在就清掉（任务记录、译文、日志文件都留着），可以给多个
    #[arg(long = "drop-events", value_name = "任务编号")]
    drop_events: Vec<String>,
    /// 不问，直接做
    #[arg(long)]
    yes: bool,
}

pub fn run(ctx: &Ctx, args: CompactArgs) -> Result<ExitCode> {
    if ctx.writer()?.is_some() {
        bail!("后端在运行：先退出 RetainPDF（或停掉开发栈）再整理，压缩要独占数据库");
    }
    if !args.yes {
        if !ui::interactive() {
            bail!("整理会改写数据库（先自动备份一份）；在脚本里请加 --yes");
        }
        if !ui::confirm("会先备份一份，再截短老任务的程序输出、压缩整个库，可能要几分钟。继续吗？")? {
            return Ok(ExitCode::from(1));
        }
    }
    let db = ctx.db()?;
    let backup = db.create_backup(KIND_MANUAL)?;
    db.prune_backups()?;
    let mut dropped = Vec::new();
    for job_id in &args.drop_events {
        let deleted = db.expire_job_events(job_id)?;
        if deleted == 0 && !ctx.json {
            ui::warn(format!("{job_id}：没有清掉事件（任务没结束、不存在，或者本来就没有事件）"));
        }
        dropped.push(json!({ "job_id": job_id, "events": deleted }));
    }
    let trimmed = db.trim_stored_process_output()?;
    let report = db.compact()?;
    if ctx.json {
        ui::print_json(&json!({
            "ok": true, "backup": backup.id, "dropped_events": dropped, "trimmed_outputs": trimmed,
            "bytes_before": report.bytes_before, "bytes_after": report.bytes_after,
        }));
    } else {
        ui::ok(format!("已备份 {}", backup.id));
        for item in &dropped {
            ui::ok(format!("{}：清掉 {} 条进度事件", item["job_id"].as_str().unwrap_or(""), item["events"]));
        }
        ui::ok(format!("截短了 {trimmed} 个任务存下的程序输出"));
        ui::ok(format!(
            "库 {} → {}，之后过期的事件空间会自动还给磁盘",
            ui::human_bytes(report.bytes_before),
            ui::human_bytes(report.bytes_after)
        ));
    }
    Ok(ExitCode::SUCCESS)
}
