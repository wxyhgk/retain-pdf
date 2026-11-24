//! `retainpdf books`：书文件夹——把书库导出成 Markdown（`<数据目录>/books/`），给 AI 直接读、grep。
//! 要读译文、生成合并阅读，只能经后端做，所以后端得开着。

use std::process::ExitCode;

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::{json, Value};

use crate::context::Ctx;
use crate::ui;

#[derive(Subcommand)]
pub enum BooksCommand {
    /// 导出（或刷新）书文件夹；不给 --document 就导出整个书库，并删掉已经不在书库里的书的文件夹
    Export {
        /// 只导出这本书（书编号，可以给多次）
        #[arg(long = "document", value_name = "书编号")]
        documents: Vec<String>,
    },
}

fn print_export(view: &Value) {
    println!("书文件夹  {}", view["root"].as_str().unwrap_or(""));
    println!(
        "这次      {} 本：重新写了 {}，没变 {}，没有内容 {}，删掉旧文件夹 {}",
        view["documents"], view["exported"], view["unchanged"], view["empty"], view["removed"]
    );
    if let Some(failed) = view["failed"].as_array().filter(|failed| !failed.is_empty()) {
        println!("失败      {} 本", failed.len());
        for item in failed {
            println!("  {}  {}", item["document_id"].as_str().unwrap_or(""), item["message"].as_str().unwrap_or(""));
        }
    }
}

pub fn run(ctx: &Ctx, action: BooksCommand) -> Result<ExitCode> {
    match action {
        BooksCommand::Export { documents } => {
            let Some(backend) = ctx.writer()? else {
                bail!("后端没开：导出书文件夹要读译文、生成合并阅读，先打开 RetainPDF 再试");
            };
            if !ctx.json {
                println!("正在导出…");
            }
            let view = backend.post("/api/v1/book-folder/export", Some(&json!({ "document_ids": documents })))?;
            if ctx.json {
                ui::print_json(&view);
            } else {
                print_export(&view);
            }
            let failed = view["failed"].as_array().is_some_and(|failed| !failed.is_empty());
            Ok(if failed { ExitCode::from(1) } else { ExitCode::SUCCESS })
        }
    }
}
