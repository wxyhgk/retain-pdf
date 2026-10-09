//! `retainpdf sync`:多设备同步。后端开着时经后端,没开时直接同步数据目录
//! (`retain_data::sync::control`,与后端同一套)。

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{bail, Result};
use clap::Subcommand;
use retain_core::models::api::SyncSettingsInput;
use retain_data::sync::SyncControl;
use serde_json::{json, Value};

use crate::context::Ctx;
use crate::ui;

#[derive(Subcommand)]
pub enum SyncCommand {
    /// 同步状态、其它设备、等待中的项目、上次整理
    Status,
    /// 立即同步一轮
    Run,
    /// 开启同步
    On,
    /// 关闭同步
    Off,
    /// 改同步位置:--folder <网盘里的文件夹>,或 --webdav <地址> --user <账号>(密码在终端里输入)
    Set {
        #[arg(long, value_name = "文件夹", conflicts_with = "webdav")]
        folder: Option<PathBuf>,
        #[arg(long, value_name = "地址")]
        webdav: Option<String>,
        #[arg(long, value_name = "账号", requires = "webdav")]
        user: Option<String>,
        /// 从标准输入读 WebDAV 密码(脚本用)
        #[arg(long, requires = "webdav")]
        password_stdin: bool,
        #[arg(long, value_name = "名字")]
        device_name: Option<String>,
    },
    /// 用现在的设置测一次能不能读写(不改设置)
    Test,
}

fn control(ctx: &Ctx) -> Result<SyncControl> {
    Ok(SyncControl::new(ctx.db()?, ctx.data_dir.clone()))
}

fn status(ctx: &Ctx) -> Result<Value> {
    match ctx.writer()? {
        Some(backend) => backend.get("/api/v1/sync"),
        None => Ok(serde_json::to_value(control(ctx)?.status_view(false, 0, Vec::new())?)?),
    }
}

fn update(ctx: &Ctx, input: SyncSettingsInput, body: Value) -> Result<Value> {
    match ctx.writer()? {
        Some(backend) => backend.call(reqwest::Method::PUT, "/api/v1/sync", Some(&body)),
        None => {
            let control = control(ctx)?;
            if let Err(reason) = control.update(&input)? {
                bail!("{}", reason.0);
            }
            Ok(serde_json::to_value(control.status_view(false, 0, Vec::new())?)?)
        }
    }
}

fn print_status(view: &Value) {
    let on = view["enabled"].as_bool() == Some(true);
    println!("同步      {}", if on { "开着" } else { "没开" });
    println!("方式      {}", if view["transport"] == "webdav" { "WebDAV" } else { "网盘文件夹" });
    println!("位置      {}", view["sync_root"].as_str().unwrap_or("未配置"));
    println!("这台电脑  {}", view["device_name"].as_str().unwrap_or(""));
    if let Some(run) = view.get("last_run").filter(|r| !r.is_null()) {
        let when: String = run["finished_at"].as_str().unwrap_or("").replace('T', " ").chars().take(16).collect();
        if run["ok"].as_bool() == Some(true) {
            println!("上次      {when} 成功:收到 {} 项,发出 {} 项", run["applied"], run["exported"]);
        } else {
            println!("上次      {when} 出错:{}", run["error"].as_str().unwrap_or(""));
        }
    }
    let pending = view["pending_total"].as_u64().unwrap_or(0);
    if pending > 0 {
        println!("等待      {pending} 项(文件还没到,或相关的书还没同步过来)");
    }
    let did_something = |m: &&Value| {
        m["segments_compacted"].as_u64().unwrap_or(0) > 0 || m["bytes_freed"].as_u64().unwrap_or(0) > 0
    };
    if let Some(m) = view.get("last_maintenance").filter(|m| !m.is_null()).filter(did_something) {
        println!(
            "上次整理  合并 {} 段旧记录,腾出 {}",
            m["segments_compacted"],
            ui::human_bytes(m["bytes_freed"].as_u64().unwrap_or(0))
        );
    }
    if let Some(peers) = view["peers"].as_array().filter(|p| !p.is_empty()) {
        let names: Vec<&str> = peers.iter().filter_map(|p| p["name"].as_str()).collect();
        println!("其它设备  {}", names.join("、"));
    }
}

pub fn run(ctx: &Ctx, action: SyncCommand) -> Result<ExitCode> {
    let output = |value: &Value| {
        if ctx.json {
            ui::print_json(value);
        } else {
            print_status(value);
        }
    };
    match action {
        SyncCommand::Status => output(&status(ctx)?),
        SyncCommand::Run => {
            let view = match ctx.writer()? {
                Some(backend) => backend.post("/api/v1/sync/run", None)?,
                None => {
                    let control = control(ctx)?;
                    if !control.enabled()? {
                        bail!("同步没有开启(`retainpdf sync on`)");
                    }
                    if !ctx.json {
                        println!("正在同步…");
                    }
                    let peers = control.run_recorded()?.map(|(_, peers)| peers).unwrap_or_default();
                    serde_json::to_value(control.status_view(false, 0, peers)?)?
                }
            };
            output(&view);
            if view["last_run"]["ok"].as_bool() == Some(false) {
                return Ok(ExitCode::from(1));
            }
        }
        SyncCommand::On | SyncCommand::Off => {
            let enabled = matches!(action, SyncCommand::On);
            let input = SyncSettingsInput { enabled: Some(enabled), ..Default::default() };
            output(&update(ctx, input, json!({ "enabled": enabled }))?);
        }
        SyncCommand::Set { folder, webdav, user, password_stdin, device_name } => {
            let mut input = SyncSettingsInput { device_name: device_name.clone(), ..Default::default() };
            let mut body = json!({});
            if let Some(name) = device_name {
                body["device_name"] = json!(name);
            }
            if let Some(folder) = folder {
                let folder = std::fs::canonicalize(&folder).unwrap_or(folder).to_string_lossy().to_string();
                input.transport = Some("folder".into());
                input.folder = Some(folder.clone());
                body["transport"] = json!("folder");
                body["folder"] = json!(folder);
            }
            if let Some(url) = webdav {
                let password = if password_stdin {
                    let mut line = String::new();
                    std::io::stdin().read_line(&mut line)?;
                    line.trim_end_matches(['\r', '\n']).to_string()
                } else {
                    ui::ask_secret("WebDAV 密码(回车保留已保存的)")?
                };
                input.transport = Some("webdav".into());
                input.webdav_url = Some(url.clone());
                input.webdav_username = user.clone();
                body["transport"] = json!("webdav");
                body["webdav_url"] = json!(url);
                if let Some(user) = user {
                    body["webdav_username"] = json!(user);
                }
                if !password.is_empty() {
                    input.webdav_password = Some(password.clone());
                    body["webdav_password"] = json!(password);
                }
            }
            if body.as_object().is_some_and(|o| o.is_empty()) {
                bail!("要改什么?--folder、--webdav 或 --device-name");
            }
            output(&update(ctx, input, body)?);
        }
        SyncCommand::Test => {
            let result = match ctx.writer()? {
                Some(backend) => backend.post("/api/v1/sync/test", Some(&json!({})))?,
                None => serde_json::to_value(control(ctx)?.test(&SyncSettingsInput::default())?)?,
            };
            if ctx.json {
                ui::print_json(&result);
            } else if result["ok"].as_bool() == Some(true) {
                ui::ok(format!(
                    "{} 读写正常({} 毫秒)",
                    result["location"].as_str().unwrap_or(""),
                    result["latency_ms"]
                ));
            } else {
                ui::bad(result["error"].as_str().unwrap_or("连不上"));
                return Ok(ExitCode::from(1));
            }
        }
    }
    Ok(ExitCode::SUCCESS)
}
