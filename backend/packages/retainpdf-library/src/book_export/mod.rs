//! 书文件夹：把书库里每本书导出成 Markdown，放在 `<数据目录>/books/`，给 AI（Claude Code、Codex……）直接读、grep。
//! 方案见 `docs/ops/planning/ai-data-access/`，用法见 `docs/api/13-书库/05-书文件夹.md`。
//!
//! ```text
//! books/
//!   README.md                  给 AI 的说明：目录结构、锚点、只读
//!   library.md                 全部书的书目（没识别的书也列）
//!   <书名>-<书编号前 8 位>/
//!     meta.json                书编号、书名、作者、页数、读的是哪个任务 / 译文版本、来源指纹、文件清单
//!     toc.md                   标题 → 页码 → 文件:行号
//!     text/NN-<章名>.md        原文和译文对照，按顶层标题分文件，每个 ≤200KB
//!     source.pdf               指向原文 PDF 的链接（建不了就只在 meta.json 写路径）
//! ```
//!
//! # 读哪份
//!
//! 和阅读入口 `GET /documents/:id/reading` 同一条规则（[`crate::reading::current_reading`]）：书的当前译文版本，
//! 没选过就自动（逐页取最新），多次范围翻译读合并结果。合并阅读里没翻译的页、以及根本没有译文的书，
//! 从最近一次成功的 OCR 任务补原文。
//!
//! # 锚点
//!
//! 每块前面一行 `<!-- p012-b0034 job=<任务> page=<文档页号> -->`：
//!
//! - `job` 是**真正有这一块的任务**，`p012-b0034` 是这块在那个任务里的 `item_id`，页号是那个任务自己的本地页号
//!   （和全文索引 `blocks_fts` 同一规则）。改译文、全文检索的跳转都按这个任务找。
//! - 合并阅读的虚拟任务（`merged-…`）把 `item_id` 的页号前缀改成了文档页号（`merge_translated_artifacts.py`），
//!   而且它是只读的；这里按合并计划（[`crate::merge::reading::page_owners`]）把它换回源任务和源任务的本地页号。
//! - `page` 是整本书的页号，给人看。
//! - 不写译文的代次：代次是整个任务共用的，改一块就全变，写进锚点等于改一处重写整本。
//!
//! # 什么时候重写
//!
//! 这一版只在调导出接口时写（`POST /api/v1/book-folder/export`、`retainpdf books export`）。每本书算一个来源指纹
//! （格式版本、书名、作者、页数、译文版本、参与的任务和它们的区块指纹），和 meta.json 里的一样就不动。
//! 改译文会改区块指纹，所以再导出一次就会重写。自动重写（改动处记一笔、启动时对账）是后续的事。

mod collect;
mod names;
mod render;
mod write;

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::DocumentRecord;
use retainpdf_core::models::domain::now_iso;
use retainpdf_data::db::Db;
use retainpdf_files::DerivedArtifactDeps;

use crate::media::document_source;
use crate::merge::reading::{page_owners, ReadingTarget};
use crate::reading::current_reading;
use crate::views::{BookFolderExportFailure, BookFolderExportInput, BookFolderExportView};
use crate::LibraryDeps;

use collect::{export_blocks, latest_ocr_job, regions_source, PageMapping};
use names::folder_name;
use render::render_book;
use write::{book_dirs_of, list_book_dirs, read_meta, remove_book_dir, remove_stale_temporaries, TempBookDir};

/// 书文件夹在数据目录下的名字。
pub(crate) const BOOKS_DIR: &str = "books";
/// 导出格式一变就加一：进了来源指纹，旧文件夹下次导出全部重写。
const FORMAT_VERSION: u32 = 1;

struct OwnedDeps {
    db: Db,
    data_root: PathBuf,
    python_bin: String,
    pipeline_command: String,
}

/// POST /api/v1/book-folder/export：导出（或刷新）书文件夹。可能要生成合并阅读的目录，放进阻塞线程。
pub async fn export_book_folder(
    deps: &LibraryDeps<'_>,
    input: BookFolderExportInput,
) -> Result<BookFolderExportView, AppError> {
    let owned = OwnedDeps {
        db: deps.db.clone(),
        data_root: deps.data_root.to_path_buf(),
        python_bin: deps.python_bin.to_string(),
        pipeline_command: deps.pipeline_command.to_string(),
    };
    tokio::task::spawn_blocking(move || export(&owned, &input))
        .await
        .map_err(|_| AppError::internal("book folder export task failed"))?
}

enum Outcome {
    Exported,
    Unchanged,
    Empty,
}

fn export(owned: &OwnedDeps, input: &BookFolderExportInput) -> Result<BookFolderExportView, AppError> {
    let books_root = owned.data_root.join(BOOKS_DIR);
    fs::create_dir_all(&books_root)?;
    remove_stale_temporaries(&books_root);
    let documents = owned.db.list_documents(u32::MAX, 0, None, None, None)?;
    let by_id: BTreeMap<&str, &DocumentRecord> =
        documents.iter().map(|document| (document.document_id.as_str(), document)).collect();

    let mut view = BookFolderExportView {
        root: books_root.to_string_lossy().into_owned(),
        documents: 0,
        exported: 0,
        unchanged: 0,
        empty: 0,
        removed: 0,
        failed: Vec::new(),
    };
    let whole_library = input.document_ids.iter().all(|id| id.trim().is_empty());
    let targets: Vec<&DocumentRecord> = if whole_library {
        documents.iter().collect()
    } else {
        let mut targets = Vec::new();
        for id in input.document_ids.iter().map(|id| id.trim()).filter(|id| !id.is_empty()) {
            match by_id.get(id) {
                Some(document) => targets.push(*document),
                None => view.failed.push(BookFolderExportFailure {
                    document_id: id.to_string(),
                    message: format!("document not found: {id}"),
                }),
            }
        }
        targets
    };

    for document in targets {
        view.documents += 1;
        match export_document(owned, &books_root, document) {
            Ok((outcome, removed)) => {
                view.removed += removed;
                match outcome {
                    Outcome::Exported => view.exported += 1,
                    Outcome::Unchanged => view.unchanged += 1,
                    Outcome::Empty => view.empty += 1,
                }
            }
            Err(error) => view.failed.push(BookFolderExportFailure {
                document_id: document.document_id.clone(),
                message: error.to_string(),
            }),
        }
    }

    if whole_library {
        // 书删了：它的文件夹也删掉。
        for (dir, document_id) in list_book_dirs(&books_root) {
            if !by_id.contains_key(document_id.as_str()) {
                remove_book_dir(&books_root, &dir)?;
                view.removed += 1;
            }
        }
    }
    write_index_files(&owned.db, &books_root, &documents)?;
    Ok(view)
}

fn sha256_hex(text: &str) -> String {
    Sha256::digest(text.as_bytes()).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn authors(document: &DocumentRecord) -> Vec<String> {
    let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&document.authors_json) else { return Vec::new() };
    items
        .iter()
        .filter_map(|item| match item {
            Value::String(name) => Some(name.trim().to_string()),
            Value::Object(fields) => fields.get("name").and_then(Value::as_str).map(|name| name.trim().to_string()),
            _ => None,
        })
        .filter(|name| !name.is_empty())
        .collect()
}

fn known_fingerprint<'a>(meta: Option<&'a Value>, job_id: &str) -> Option<&'a str> {
    meta?.get("sources")?.as_array()?.iter().find_map(|source| {
        (source.get("job_id")?.as_str()? == job_id).then(|| source.get("regions_fingerprint")?.as_str()).flatten()
    })
}

/// 导出一本书。返回结果和删掉了几个旧文件夹。
fn export_document(owned: &OwnedDeps, books_root: &Path, document: &DocumentRecord) -> Result<(Outcome, u32), AppError> {
    let (db, data_root) = (&owned.db, owned.data_root.as_path());
    let document_id = document.document_id.as_str();
    let name = folder_name(&document.title, document_id);
    let existing = book_dirs_of(books_root, document_id);
    let current_dir = books_root.join(&name);
    let current_meta = existing.iter().any(|dir| dir == &current_dir).then(|| read_meta(&current_dir)).flatten();
    let remove_others = |keep: Option<&Path>| -> Result<u32, AppError> {
        let mut removed = 0;
        for dir in existing.iter().filter(|dir| Some(dir.as_path()) != keep) {
            remove_book_dir(books_root, dir)?;
            removed += 1;
        }
        Ok(removed)
    };

    // 读哪份：和阅读入口一样。原文 PDF 不在了就读不了译文，只能补原文。
    let artifact_deps = DerivedArtifactDeps::with_pipeline_command(&owned.python_bin, &owned.pipeline_command);
    let reading = match document_source(db, data_root, document_id) {
        Ok(_) => Some(current_reading(db, data_root, artifact_deps, document_id, None)?),
        Err(_) => None,
    };
    let source_pdf = reading.as_ref().map(|reading| reading.source_pdf.clone());
    let reading_view = reading.as_ref().map(|reading| reading.target.view(data_root));
    let (primary, mapping) = match reading.as_ref().map(|reading| &reading.target) {
        Some(ReadingTarget::Job(job_id)) => (Some(job_id.clone()), PageMapping::Local),
        Some(ReadingTarget::Merged { job_id, .. }) => {
            let reading = reading.as_ref().expect("matched Some");
            let owners = page_owners(db, data_root, document_id, &reading.source_pdf, document.page_count, &reading.selection)?;
            (Some(job_id.clone()), PageMapping::Merged(owners))
        }
        Some(ReadingTarget::None) | None => (None, PageMapping::Local),
    };
    // 合并阅读里没有任务覆盖的页、没有译文的书：从 OCR 任务补原文。
    let owned_pages: BTreeSet<u32> = match &mapping {
        PageMapping::Merged(owners) => {
            owners.iter().enumerate().filter(|(_, owner)| owner.is_some()).map(|(index, _)| index as u32 + 1).collect()
        }
        PageMapping::Local => BTreeSet::new(),
    };
    let needs_fallback = match &mapping {
        PageMapping::Merged(owners) => owners.iter().any(Option::is_none),
        PageMapping::Local => primary.is_none(),
    };
    let fallback = if needs_fallback {
        latest_ocr_job(db, data_root, document_id)?.filter(|job_id| Some(job_id) != primary.as_ref())
    } else {
        None
    };
    if primary.is_none() && fallback.is_none() {
        return Ok((Outcome::Empty, remove_others(None)?));
    }

    let mut primary_source = primary
        .as_deref()
        .map(|job_id| regions_source(db, data_root, job_id, known_fingerprint(current_meta.as_ref(), job_id)))
        .transpose()?;
    let mut fallback_source = fallback
        .as_deref()
        .map(|job_id| regions_source(db, data_root, job_id, known_fingerprint(current_meta.as_ref(), job_id)))
        .transpose()?;
    let version_id = reading.as_ref().and_then(|reading| reading.version_id.clone());
    let fingerprint = sha256_hex(
        &json!([
            FORMAT_VERSION,
            document_id,
            document.title,
            document.authors_json,
            document.page_count,
            version_id,
            source_pdf,
            primary_source.as_ref().map(|source| [&source.job_id, &source.fingerprint]),
            fallback_source.as_ref().map(|source| [&source.job_id, &source.fingerprint]),
        ])
        .to_string(),
    );
    if current_meta.as_ref().and_then(|meta| meta.get("fingerprint")?.as_str()) == Some(fingerprint.as_str()) {
        return Ok((Outcome::Unchanged, remove_others(Some(&current_dir))?));
    }

    let mut blocks = Vec::new();
    if let Some(source) = primary_source.as_mut() {
        blocks.extend(export_blocks(db, data_root, source, &mapping, true, &BTreeSet::new())?);
    }
    // 补原文的任务一页也没补上（它覆盖的页都已经有译文）：meta.json 不说「部分页只有原文」。
    let mut filled_source_only = false;
    if let Some(source) = fallback_source.as_mut() {
        let filled = export_blocks(db, data_root, source, &PageMapping::Local, false, &owned_pages)?;
        filled_source_only = !filled.is_empty();
        blocks.extend(filled);
    }
    blocks.sort_by_key(|block| block.page);
    let rendered = render_book(&document.title, &blocks);

    let temp = TempBookDir::new(books_root, &name)?;
    for file in &rendered.files {
        temp.write(&format!("text/{}", file.name), file.content.as_bytes())?;
    }
    temp.write("toc.md", rendered.toc.as_bytes())?;
    let linked = source_pdf.as_deref().is_some_and(|path| temp.link_source_pdf(path));
    let role_sources: Vec<Value> = [(&primary_source, "reading"), (&fallback_source, "source_only")]
        .into_iter()
        .filter_map(|(source, role)| {
            source.as_ref().map(|source| {
                json!({ "job_id": source.job_id, "regions_fingerprint": source.fingerprint, "role": role })
            })
        })
        .collect();
    let meta = json!({
        "format_version": FORMAT_VERSION,
        "document_id": document_id,
        "title": document.title,
        "authors": authors(document),
        "page_count": document.page_count,
        "reading": primary_source.as_ref().map(|_| {
            let view = reading_view.as_ref();
            json!({
                "job_id": view.and_then(|view| view.job_id.clone()),
                "merged": view.is_some_and(|view| view.merged),
                "contributing_job_ids": view.map(|view| view.contributing_job_ids.clone()).unwrap_or_default(),
                "version_id": version_id,
            })
        }),
        "source_only_job_id": fallback_source.as_ref().filter(|_| filled_source_only).map(|source| source.job_id.clone()),
        "sources": role_sources,
        "fingerprint": fingerprint,
        "generated_at": now_iso(),
        "source_pdf": source_pdf.as_ref().map(|path| path.to_string_lossy().into_owned()),
        "source_pdf_linked": linked,
        "files": rendered
            .files
            .iter()
            .map(|file| json!({ "path": format!("text/{}", file.name), "first_page": file.first_page, "last_page": file.last_page }))
            .collect::<Vec<_>>(),
    });
    temp.write("meta.json", serde_json::to_string_pretty(&meta).unwrap_or_default().as_bytes())?;
    let published = temp.publish()?;
    Ok((Outcome::Exported, remove_others(Some(&published))?))
}

fn table_cell(text: &str) -> String {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ").replace('|', "\\|");
    if text.is_empty() { "—".to_string() } else { text }
}

/// `library.md`（书目）和 `README.md`（给 AI 的说明）。每次导出都重写，整份换上去。
fn write_index_files(db: &Db, books_root: &Path, documents: &[DocumentRecord]) -> Result<(), AppError> {
    let mut collections_of: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for collection in db.list_collections()? {
        for document in db.list_documents(u32::MAX, 0, None, Some(&collection.collection_id), None)? {
            collections_of.entry(document.document_id).or_default().push(collection.name.clone());
        }
    }
    let folders: BTreeMap<String, (String, Value)> = list_book_dirs(books_root)
        .into_iter()
        .filter_map(|(dir, document_id)| {
            let name = dir.file_name()?.to_string_lossy().into_owned();
            Some((document_id, (name, read_meta(&dir)?)))
        })
        .collect();
    let mut out = String::from(
        "# 书库\n\n由 RetainPDF 生成，别手改（下次导出会覆盖）。每本书一个文件夹，格式见 `README.md`。\n\n\
         | 书名 | 作者 | 标签 | 合集 | 内容 | 文件夹 |\n|---|---|---|---|---|---|\n",
    );
    for document in documents {
        let tags: Vec<&str> = document.tags.iter().map(|tag| tag.name.as_str()).collect();
        let collections = collections_of.get(&document.document_id).map(|names| names.join("、")).unwrap_or_default();
        let (content, folder) = match folders.get(&document.document_id) {
            Some((name, meta)) => {
                let content = match meta.get("reading") {
                    Some(reading) if !reading.is_null() => {
                        if meta.get("source_only_job_id").is_some_and(|id| !id.is_null()) {
                            "原文 + 译文（部分页只有原文）"
                        } else {
                            "原文 + 译文"
                        }
                    }
                    _ => "只有原文",
                };
                (content.to_string(), format!("`{name}/`"))
            }
            None => ("没有（还没识别，或还没导出）".to_string(), "—".to_string()),
        };
        out.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} |\n",
            table_cell(&document.title),
            table_cell(&authors(document).join("、")),
            table_cell(&tags.join("、")),
            table_cell(&collections),
            content,
            folder,
        ));
    }
    replace_file(books_root, "library.md", out.as_bytes())?;
    replace_file(books_root, "README.md", README.as_bytes())?;
    Ok(())
}

fn replace_file(dir: &Path, name: &str, bytes: &[u8]) -> Result<(), AppError> {
    let temporary = dir.join(format!(".tmp-{name}-{:016x}", fastrand::u64(..)));
    fs::write(&temporary, bytes)?;
    if let Err(error) = fs::rename(&temporary, dir.join(name)) {
        let _ = fs::remove_file(&temporary);
        return Err(error.into());
    }
    Ok(())
}

const README: &str = "# 书文件夹

RetainPDF 书库里的书，导出成 Markdown 给 AI 读。**只读**：这里的文件由 RetainPDF 生成，改了也会被下次导出覆盖；
要改译文请在 RetainPDF 里改。

- `library.md`：全部书的书目（书名、作者、标签、合集、有没有内容、文件夹）。没识别的书只在这里出现。
- `<书名>-<书编号前 8 位>/`：一本书。
  - `meta.json`：书编号、书名、作者、页数、读的是哪个任务和译文版本、文件清单。
  - `toc.md`：目录。标题 → 页码 → `text/文件:行号`，先看目录再跳到对应位置读。
  - `text/NN-<章名>.md`：正文，按章分文件。原文在前，译文是紧跟着的 `>` 引用块；没翻译的块只有原文。
  - `source.pdf`：原文 PDF（链接）。公式、表格识别得不好时看原页面。

每块前面有一行锚点：

```
<!-- p012-b0034 job=<任务编号> page=12 -->
```

- `page` 是整本书的页码。
- 引用时写书编号（`meta.json` 的 `document_id`）+ `job` + 块编号（`p012-b0034`），再附一小段原文：
  重新识别后块编号会变，靠原文找回来。

页眉、页脚、页码没有导出。搜索可以直接全目录 grep，原文和译文都能搜到。
";

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
