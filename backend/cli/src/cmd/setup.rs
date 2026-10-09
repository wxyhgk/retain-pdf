//! `retainpdf setup`:一问一答地配好翻译和 OCR,写进 ~/.retainpdf/。
//!
//! 填完当场检测:后端开着时用后端的检测接口(翻译 key 用一次真实的小请求验模型名,
//! DeepSeek 顺带查余额;OCR token 问服务商);后端没开时先保存,提示打开应用后再检测。

use std::process::ExitCode;

use anyhow::Result;
use retain_config::providers::{model_provider, MODEL_PROVIDERS, OCR_PROVIDERS};

/// 思考深度的选项(与 `providers.<id>.thinking` 一致)。
const THINKING_OPTIONS: &[(&str, &str)] = &[
    ("auto", "自动:能关就关,翻译用不着思考"),
    ("off", "关闭"),
    ("low", "浅"),
    ("medium", "中"),
    ("high", "深"),
    ("max", "最深"),
];
use serde_json::{json, Value};

use crate::context::{BackendState, Ctx};
use crate::ui;

fn choose(label: &str, options: &[(&str, &str)], current: &str) -> Result<String> {
    println!("{label}:");
    for (i, (id, name)) in options.iter().enumerate() {
        let mark = if *id == current { "  ← 现在用的" } else { "" };
        println!("  {}. {name}({id}){mark}", i + 1);
    }
    loop {
        let default = options.iter().position(|(id, _)| *id == current).map(|i| (i + 1).to_string()).unwrap_or_default();
        let answer = ui::ask("选一个(编号或名字)", &default)?;
        let picked = answer
            .parse::<usize>()
            .ok()
            .and_then(|n| options.get(n.wrapping_sub(1)))
            .or_else(|| options.iter().find(|(id, _)| id.eq_ignore_ascii_case(&answer)));
        match picked {
            Some((id, _)) => return Ok(id.to_string()),
            None => ui::warn("没有这一项,再选一次"),
        }
    }
}

fn check_translation(ctx: &Ctx, base_url: &str, model: &str, api_key: &str, provider: &str, protocol: &str) {
    let BackendState::Running(backend) = &ctx.backend else {
        ui::warn("后端没开,先保存不检测;打开 RetainPDF 后运行 `retainpdf doctor` 检测");
        return;
    };
    let body = json!({ "api_key": api_key, "base_url": base_url, "model": model, "api_protocol": protocol });
    match backend.post("/api/v1/providers/deepseek/validate-token", Some(&body)) {
        Ok(view) if view.get("ok").and_then(Value::as_bool) == Some(true) => {
            ui::ok(view.get("summary").and_then(Value::as_str).unwrap_or("翻译接口可用"));
            if provider == "deepseek" {
                if let Ok(balance) = backend.post("/api/v1/providers/deepseek/balance", Some(&body)) {
                    if let Some(summary) = balance.get("summary").and_then(Value::as_str) {
                        println!("  {summary}");
                    }
                }
            }
        }
        Ok(view) => ui::bad(view.get("summary").and_then(Value::as_str).unwrap_or("翻译接口检测没通过")),
        Err(error) => ui::warn(format!("检测失败:{error:#}")),
    }
}

fn check_ocr(ctx: &Ctx, provider: &str, token: &str) {
    let BackendState::Running(backend) = &ctx.backend else {
        return;
    };
    let (path, body) = match provider {
        "mineru" => ("/api/v1/providers/mineru/validate-token", json!({ "mineru_token": token })),
        _ => ("/api/v1/providers/paddle/validate-token", json!({ "paddle_token": token })),
    };
    match backend.post(path, Some(&body)) {
        Ok(view) if view.get("ok").and_then(Value::as_bool) == Some(true) => {
            ui::ok(view.get("summary").and_then(Value::as_str).unwrap_or("OCR token 可用"))
        }
        Ok(view) => ui::bad(view.get("summary").and_then(Value::as_str).unwrap_or("OCR token 检测没通过")),
        Err(error) => ui::warn(format!("检测失败:{error:#}")),
    }
}

pub fn run(ctx: &Ctx) -> Result<ExitCode> {
    if !ui::interactive() {
        anyhow::bail!("setup 要在终端里回答问题;脚本里请用 `retainpdf config set <项> <值>`");
    }
    let current = ctx.settings()?;
    println!("配置会写进 {}(密钥在 credentials.toml,只有你能读)。直接回车保留现在的值。\n", ctx.home.dir().display());

    // 翻译。
    let options: Vec<(&str, &str)> = MODEL_PROVIDERS.iter().map(|p| (p.id, p.label)).collect();
    let provider = choose("翻译用哪个服务商", &options, &current.translation.provider)?;
    let builtin = model_provider(&provider).expect("chosen from the list");
    let same = provider == current.translation.provider;
    let base = format!("providers.{provider}");
    // 自定义服务商才问协议;内置服务商用它自己的协议(要改用 `config set providers.<id>.protocol`)。
    let protocol = if builtin.base_url.is_empty() {
        let current_protocol = if same { current.translation.protocol.as_str() } else { builtin.protocol };
        choose(
            "接口协议",
            &[("openai", "OpenAI 格式(/chat/completions)"), ("anthropic", "Anthropic 格式(/messages)")],
            current_protocol,
        )?
    } else if same {
        current.translation.protocol.clone()
    } else {
        builtin.protocol.to_string()
    };
    let base_url = if builtin.base_url.is_empty() {
        let existing = if same { current.translation.base_url.clone() } else { String::new() };
        ui::ask("接口地址(如 https://llm.example.com/v1)", &existing)?
    } else {
        String::new()
    };
    let model_default = if same { current.translation.model.clone() } else { builtin.default_model.to_string() };
    let model = ui::ask("模型", &model_default)?;
    let workers_default = if same { current.translation.workers } else { builtin.default_workers };
    let workers = loop {
        let answer = ui::ask(&format!("并发(1–{})", builtin.max_workers), &workers_default.to_string())?;
        match answer.parse::<u64>() {
            Ok(n) if (1..=builtin.max_workers).contains(&n) => break n,
            _ => ui::warn(format!("请输入 1 到 {} 的整数", builtin.max_workers)),
        }
    };
    let thinking = choose(
        "思考深度",
        THINKING_OPTIONS,
        if same { current.translation.thinking.as_str() } else { "auto" },
    )?;
    let existing_key = ctx.home.settings()?.translation.api_key.filter(|_| same);
    let hint = if existing_key.is_some() { "API Key(回车保留已保存的)" } else { "API Key" };
    let typed = ui::ask_secret(hint)?;
    let api_key = if typed.is_empty() { existing_key.clone() } else { Some(typed.clone()) };

    ctx.home.set("translation.provider", &provider)?;
    if !base_url.is_empty() {
        ctx.home.set(&format!("{base}.base_url"), &base_url)?;
    }
    if !model.is_empty() {
        ctx.home.set(&format!("{base}.model"), &model)?;
    }
    ctx.home.set(&format!("{base}.workers"), &workers.to_string())?;
    if builtin.base_url.is_empty() {
        ctx.home.set(&format!("{base}.protocol"), &protocol)?;
    }
    ctx.home.set(&format!("{base}.thinking"), &thinking)?;
    if !typed.is_empty() {
        ctx.home.set(&format!("{base}.api_key"), &typed)?;
    }
    match &api_key {
        Some(key) => {
            let effective_url = if base_url.is_empty() { builtin.base_url.to_string() } else { base_url.clone() };
            check_translation(ctx, &effective_url, &model, key, &provider, &protocol);
        }
        None => ui::warn("还没有翻译 API Key,翻译前要补上:retainpdf config set providers.<服务商>.api_key"),
    }
    println!();

    // OCR。
    let ocr_options: Vec<(&str, &str)> = OCR_PROVIDERS
        .iter()
        .map(|(id, _)| (*id, if *id == "paddle" { "PaddleOCR" } else { "MinerU" }))
        .collect();
    let ocr = choose("OCR 用哪家", &ocr_options, &current.ocr_provider)?;
    let token_key = OCR_PROVIDERS.iter().find(|(id, _)| *id == ocr).map(|(_, k)| *k).expect("listed");
    ctx.home.set("ocr.provider", &ocr)?;
    let saved_token = ctx.home.settings()?.ocr_token;
    let hint = if saved_token.is_some() { "token(回车保留已保存的)" } else { "token" };
    let token = ui::ask_secret(hint)?;
    if !token.is_empty() {
        ctx.home.set(&format!("ocr.{token_key}"), &token)?;
    }
    match if token.is_empty() { saved_token } else { Some(token) } {
        Some(token) => check_ocr(ctx, &ocr, &token),
        None => ui::warn(format!("还没有 OCR token,翻译前要补上:retainpdf config set ocr.{token_key}")),
    }

    println!();
    ui::ok(format!("已保存。`retainpdf config show` 查看,`retainpdf config edit` 直接改文件。"));
    Ok(ExitCode::SUCCESS)
}
