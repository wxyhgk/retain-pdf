//! `retainpdf config`:查看和修改 ~/.retainpdf/ 里的配置。

use std::process::ExitCode;

use anyhow::{bail, Result};
use clap::Subcommand;
use retain_config::keys::mask;
use retain_config::settings::{ModelConnection, ENV_OVERRIDES};
use retain_config::{describe_key, known_keys, KeyKind, Settings, Source, Store};
use serde_json::{json, Value};

use crate::context::Ctx;
use crate::ui;

#[derive(Subcommand)]
pub enum ConfigCommand {
    /// 现在生效的设置,以及每一项从哪来(密钥只显示末四位)
    Show,
    /// 看文件里某一项的值
    Get { key: String },
    /// 改一项;密钥类的不给值就在终端里输入(不回显)
    Set { key: String, value: Option<String> },
    /// 删掉一项(回到默认)
    Unset { key: String },
    /// 能配哪些项
    Keys,
    /// 配置文件在哪
    Path,
    /// 用编辑器打开 config.toml(加 --credentials 打开密钥文件)
    Edit {
        #[arg(long)]
        credentials: bool,
    },
}

fn source_label(settings: &Settings, key: &str) -> String {
    match settings.source(key) {
        Source::Default => "默认".into(),
        Source::File => "配置文件".into(),
        Source::Env => {
            let name = ENV_OVERRIDES.iter().find(|(k, _)| *k == key).map_or("", |(_, n)| *n);
            format!("环境变量 {name}")
        }
    }
}

fn secret_label(secret: &Option<String>) -> String {
    secret.as_deref().map(mask).unwrap_or_else(|| "未填".into())
}

fn connection_rows(settings: &Settings, prefix: &str, conn: &ModelConnection) -> Vec<(String, String, String)> {
    vec![
        (format!("{prefix}.provider"), conn.provider.clone(), source_label(settings, &format!("{prefix}.provider"))),
        (format!("{prefix}.model"), conn.model.clone(), source_label(settings, &format!("{prefix}.model"))),
        (
            format!("{prefix}.base_url"),
            if conn.base_url.is_empty() { "未填".into() } else { conn.base_url.clone() },
            source_label(settings, &format!("{prefix}.base_url")),
        ),
        (format!("{prefix}.workers"), conn.workers.to_string(), source_label(settings, &format!("{prefix}.workers"))),
        (format!("{prefix}.api_key"), secret_label(&conn.api_key), source_label(settings, &format!("{prefix}.api_key"))),
    ]
}

/// `config show` 的行:(生效的键, 值, 来源)。
pub fn show_rows(settings: &Settings) -> Vec<(String, String, String)> {
    let mut rows = connection_rows(settings, "translation", &settings.translation);
    if let Some(reviewer) = &settings.reviewer {
        rows.extend(connection_rows(settings, "translation.reviewer", reviewer));
    }
    rows.push(("ocr.provider".into(), settings.ocr_provider.clone(), source_label(settings, "ocr.provider")));
    rows.push(("ocr.token".into(), secret_label(&settings.ocr_token), source_label(settings, "ocr.token")));
    let mut assistant = connection_rows(settings, "assistant", &settings.assistant);
    assistant.retain(|(key, _, _)| key != "assistant.workers");
    rows.extend(assistant);
    let optional = |value: Option<u64>| value.map_or("默认".to_string(), |v| v.to_string());
    rows.push((
        "backend.data_dir".into(),
        settings.data_dir.as_ref().map_or("桌面版默认".into(), |p| p.display().to_string()),
        source_label(settings, "backend.data_dir"),
    ));
    rows.push(("backend.max_running_jobs".into(), optional(settings.max_running_jobs), source_label(settings, "backend.max_running_jobs")));
    rows
}

fn value_text(value: &toml_edit::Value) -> String {
    match value {
        toml_edit::Value::String(s) => s.value().to_string(),
        other => other.to_string().trim().to_string(),
    }
}

pub fn run(ctx: &Ctx, action: ConfigCommand) -> Result<ExitCode> {
    match action {
        ConfigCommand::Show => {
            let settings = ctx.settings()?;
            let rows = show_rows(&settings);
            if ctx.json {
                let items: Vec<Value> = rows.iter().map(|(k, v, s)| json!({ "key": k, "value": v, "source": s })).collect();
                ui::print_json(&json!({ "dir": ctx.home.dir(), "settings": items }));
            } else {
                println!("配置目录:{}", ctx.home.dir().display());
                let width = rows.iter().map(|(k, _, _)| k.len()).max().unwrap_or(0);
                for (key, value, source) in rows {
                    println!("  {key:<width$}  {value}   ({source})");
                }
            }
        }
        ConfigCommand::Get { key } => {
            let value = ctx.home.get(&key)?;
            let info = describe_key(&key).expect("checked by get");
            let shown = value.as_ref().map(|v| {
                let text = value_text(v);
                if info.kind == KeyKind::Secret { mask(&text) } else { text }
            });
            if ctx.json {
                ui::print_json(&json!({ "key": key, "value": shown }));
            } else {
                println!("{}", shown.unwrap_or_else(|| "(没写,用默认)".into()));
            }
        }
        ConfigCommand::Set { key, value } => {
            let Some(info) = describe_key(&key) else {
                bail!("没有这个配置项:{key}(`retainpdf config keys` 列出全部)");
            };
            let value = match value {
                Some(value) => value,
                None if info.kind == KeyKind::Secret => ui::ask_secret(&info.help)?,
                None => bail!("请给出值:retainpdf config set {key} <值>"),
            };
            ctx.home.set(&key, &value)?;
            if ctx.json {
                ui::print_json(&json!({ "ok": true, "key": key }));
            } else {
                let file = if info.store == Store::Credentials { ctx.home.credentials_path() } else { ctx.home.config_path() };
                ui::ok(format!("已保存 {key}({})", file.display()));
            }
        }
        ConfigCommand::Unset { key } => {
            let removed = ctx.home.unset(&key)?;
            if ctx.json {
                ui::print_json(&json!({ "ok": true, "removed": removed }));
            } else if removed {
                ui::ok(format!("已删掉 {key},回到默认"));
            } else {
                println!("{key} 本来就没写");
            }
        }
        ConfigCommand::Keys => {
            let keys = known_keys();
            if ctx.json {
                let items: Vec<Value> = keys
                    .iter()
                    .map(|k| json!({ "key": k.path, "file": if k.store == Store::Credentials { "credentials.toml" } else { "config.toml" }, "help": k.help }))
                    .collect();
                ui::print_json(&json!(items));
            } else {
                let width = keys.iter().map(|k| k.path.len()).max().unwrap_or(0);
                for key in keys {
                    let mark = if key.store == Store::Credentials { " [密钥]" } else { "" };
                    println!("  {:<width$}  {}{mark}", key.path, key.help);
                }
                println!("\n环境变量(优先于文件):");
                for (key, name) in ENV_OVERRIDES {
                    println!("  {name:<34} {key}");
                }
            }
        }
        ConfigCommand::Path => {
            if ctx.json {
                ui::print_json(&json!({
                    "dir": ctx.home.dir(),
                    "config": ctx.home.config_path(),
                    "credentials": ctx.home.credentials_path(),
                    "data_dir": ctx.data_dir,
                }));
            } else {
                println!("配置目录  {}", ctx.home.dir().display());
                println!("设置      {}", ctx.home.config_path().display());
                println!("密钥      {}", ctx.home.credentials_path().display());
                println!("数据目录  {}", ctx.data_dir.display());
            }
        }
        ConfigCommand::Edit { credentials } => {
            ctx.home.ensure_files()?;
            let path = if credentials { ctx.home.credentials_path() } else { ctx.home.config_path() };
            let editor = std::env::var("VISUAL")
                .or_else(|_| std::env::var("EDITOR"))
                .unwrap_or_else(|_| if cfg!(windows) { "notepad".into() } else { "vi".into() });
            let status = std::process::Command::new(&editor).arg(&path).status()?;
            if !status.success() {
                bail!("编辑器 {editor} 没有正常退出");
            }
            // 改完马上检查一遍,写错了当场说。
            ctx.settings()?;
            ui::ok("配置检查通过");
        }
    }
    Ok(ExitCode::SUCCESS)
}
