//! `retainpdf db-snapshot`：数据库重做的比对工具（开发用，帮助里不列）。
//!
//! 每一步改表结构，迁移前后用它比对「数据库层读出来的东西」是不是一模一样（见
//! `docs/ops/planning/database-redesign/` 和 retainpdf-db 的 `snapshot_diff`）：
//!
//! ```text
//! sqlite3 <数据目录>/db/jobs.db ".backup /tmp/x/before.db"    # 复制两份（不要直接 cp 正在用的库）
//! cp /tmp/x/before.db /tmp/x/after.db
//! <旧程序> db-snapshot dump --db /tmp/x/before.db --out /tmp/x/before.jsonl
//! <新程序> db-snapshot dump --db /tmp/x/after.db  --out /tmp/x/after.jsonl   # 打开时按新程序升级
//! retainpdf db-snapshot diff /tmp/x/before.jsonl /tmp/x/after.jsonl [--ignore 类别:字段]
//! ```
//!
//! 打开旧版本的库会升级它，所以 `dump` 只许对副本用，给的是正在用的库会拒绝。

use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use serde_json::json;

use retainpdf_data::db::snapshot_diff::{compare_dumps, DumpEntry};
use retainpdf_data::db::Db;

use crate::context::Ctx;
use crate::ui;

#[derive(Subcommand)]
pub enum DbSnapshotCommand {
    /// 把数据库层读出来的东西导成一行一条的 JSON（只对库的副本用）
    Dump {
        /// 库文件的副本
        #[arg(long, value_name = "文件")]
        db: PathBuf,
        /// 写到哪里（.jsonl）
        #[arg(long, value_name = "文件")]
        out: PathBuf,
    },
    /// 比对两份导出：一样退出码 0，有不同 1
    Diff {
        before: PathBuf,
        after: PathBuf,
        /// 有意变化、不算不同的地方：`类别` 或 `类别:字段路径前缀`，可以给多个
        #[arg(long, value_name = "规则")]
        ignore: Vec<String>,
        /// 最多列出几处不同（计数照样是全的）
        #[arg(long, default_value_t = 50)]
        limit: usize,
    },
}

pub fn run(ctx: &Ctx, command: DbSnapshotCommand) -> Result<ExitCode> {
    match command {
        DbSnapshotCommand::Dump { db, out } => dump(ctx, &db, &out),
        DbSnapshotCommand::Diff { before, after, ignore, limit } => diff(ctx, &before, &after, &ignore, limit),
    }
}

fn dump(ctx: &Ctx, db_path: &Path, out: &Path) -> Result<ExitCode> {
    if !db_path.is_file() {
        bail!("{} 不存在", db_path.display());
    }
    if let (Ok(given), Ok(live)) = (std::fs::canonicalize(db_path), std::fs::canonicalize(ctx.db_path())) {
        if given == live {
            bail!("这是正在用的库：打开旧版本的库会升级它，先复制一份（sqlite3 <库> \".backup <副本>\"）再导");
        }
    }
    // 升级前的自动备份写到副本旁边，不碰真正的数据目录。
    let data_root = db_path.parent().map(Path::to_path_buf).unwrap_or_default().join("snapshot-data");
    let db = Db::new(db_path.to_path_buf(), data_root);
    let mut writer = BufWriter::new(File::create(out).with_context(|| format!("写不了 {}", out.display()))?);
    let count = db.dump_read_model(|entry| {
        serde_json::to_writer(&mut writer, &entry)?;
        writer.write_all(b"\n")?;
        Ok(())
    })?;
    writer.flush()?;
    if ctx.json {
        ui::print_json(&json!({ "ok": true, "entries": count, "out": out }));
    } else {
        ui::ok(format!("导出 {count} 条到 {}", out.display()));
    }
    Ok(ExitCode::SUCCESS)
}

/// 一行一条地读导出，不整份读进内存。
fn read_dump(path: &Path) -> Result<impl Iterator<Item = Result<DumpEntry>>> {
    let file = File::open(path).with_context(|| format!("读不了 {}", path.display()))?;
    let shown = path.display().to_string();
    Ok(BufReader::new(file).lines().enumerate().filter_map(move |(index, line)| match line {
        Err(error) => Some(Err(error.into())),
        Ok(line) if line.trim().is_empty() => None,
        Ok(line) => Some(
            serde_json::from_str(&line).with_context(|| format!("{shown} 第 {} 行不是导出的记录", index + 1)),
        ),
    }))
}

fn diff(ctx: &Ctx, before: &Path, after: &Path, ignore: &[String], limit: usize) -> Result<ExitCode> {
    let report = compare_dumps(read_dump(before)?, read_dump(after)?, ignore, limit)?;
    let same = report.by_kind.is_empty();
    if ctx.json {
        ui::print_json(&json!({ "ok": same, "report": report }));
    } else {
        for difference in &report.differences {
            let place = if difference.path.is_empty() { String::new() } else { format!(" {}", difference.path) };
            let show = |value: &Option<serde_json::Value>| value.as_ref().map_or("（没有）".to_string(), |v| v.to_string());
            println!(
                "{}/{}{}：{} → {}",
                difference.kind,
                difference.id,
                place,
                show(&difference.before),
                show(&difference.after)
            );
        }
        let total: usize = report.by_kind.values().sum();
        if same {
            ui::ok(format!("比了 {} 条，一样（按规则跳过 {} 条）", report.compared, report.ignored));
        } else {
            let kinds: Vec<String> = report.by_kind.iter().map(|(kind, n)| format!("{kind} {n}")).collect();
            ui::warn(format!(
                "比了 {} 条，{} 处不同（{}）{}",
                report.compared,
                total,
                kinds.join("、"),
                if total > report.differences.len() { format!("，上面只列了前 {} 处", report.differences.len()) } else { String::new() }
            ));
        }
    }
    Ok(if same { ExitCode::SUCCESS } else { ExitCode::from(1) })
}
