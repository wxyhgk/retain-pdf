//! `retainpdf`:RetainPDF 的命令行。
//!
//! 配置在 `~/.retainpdf/`(见 retain-config),与桌面版共用。后端开着时会改东西的命令转给
//! 后端,没开时直接操作数据目录(见 `context.rs`)。默认输出给人看,`--json` 给脚本。

mod cmd;
mod context;
mod ui;

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};

use crate::cmd::{backup, config, doctor, setup, status, sync};
use crate::context::Ctx;

#[derive(Parser)]
#[command(name = "retainpdf", version, about = "RetainPDF 命令行:配置、状态、环境检查、备份、同步")]
struct Cli {
    /// 输出 JSON(给脚本用)
    #[arg(long, global = true)]
    json: bool,
    /// 数据目录(默认:配置里的,或桌面版的)
    #[arg(long, global = true, value_name = "目录")]
    data: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 一问一答地配置:翻译服务商、模型、并发、API Key、OCR
    Setup,
    /// 查看和修改配置(~/.retainpdf/)
    Config {
        #[command(subcommand)]
        action: config::ConfigCommand,
    },
    /// 后端、数据目录、书库、同步、备份的概况
    Status,
    /// 检查环境哪里不对
    Doctor,
    /// 书库数据库的备份与恢复
    Backup {
        #[command(subcommand)]
        action: backup::BackupCommand,
    },
    /// 多设备同步
    Sync {
        #[command(subcommand)]
        action: sync::SyncCommand,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let outcome = Ctx::load(cli.json, cli.data).and_then(|ctx| match cli.command {
        Command::Setup => setup::run(&ctx),
        Command::Config { action } => config::run(&ctx, action),
        Command::Status => status::run(&ctx),
        Command::Doctor => doctor::run(&ctx),
        Command::Backup { action } => backup::run(&ctx, action),
        Command::Sync { action } => sync::run(&ctx, action),
    });
    match outcome {
        Ok(code) => code,
        Err(error) => {
            if cli.json {
                eprintln!("{}", serde_json::json!({ "ok": false, "error": format!("{error:#}") }));
            } else {
                eprintln!("错误:{error:#}");
            }
            ExitCode::from(1)
        }
    }
}
