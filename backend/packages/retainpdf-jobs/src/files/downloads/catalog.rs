//! `/jobs/:id/files/…` 的文件名表和文件清单。
//!
//! 任务的文件按"给谁用"分三组（见 docs/ops/planning/api-reorg/20261015-任务与文件接口整理.md）：
//! - `output/`：成品，给用户下载、在浏览器里看；
//! - `pages/`：译文单页预览图，给界面用；
//! - `internal/`：中间产物，给排查用，多用户模式下只给管理员（访问策略在 accounts::access）。
//!
//! 文件名一律是"内容.格式"。这里只把新文件名翻成 [`JobFile`]，找文件还是 `files.rs` 的 `locate`。

use std::path::Path;

use serde::Serialize;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::to_absolute_url;
use retainpdf_files::document_file_path;
use crate::views::JobFilesQuery;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_files::{job_upload_id, list_registry_for_job};
use retainpdf_core::storage_paths::{resolve_job_root, resolve_markdown_path, resolve_output_pdf, resolve_source_pdf};

use crate::files::downloads::files::JobFile;
use crate::presentation::book_document_id;
use crate::summary_loaders::SummaryCache;
use retainpdf_core::storage_paths::{
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_MARKDOWN_RAW, ARTIFACT_KEY_SOURCE_PDF, ARTIFACT_KEY_TRANSLATED_PDF,
};

/// `internal/` 组：新文件名 ↔ 产物清单里的名字。表在 retainpdf-core，产物清单返回的链接也用它。
use retainpdf_files::JOB_INTERNAL_FILES as INTERNAL_FILES;

const OCR_IMAGES_PREFIX: &str = "ocr/images/";

fn not_found(group: &str, name: &str) -> AppError {
    AppError::not_found(format!("no such file: {group}/{name}"))
}

/// 地址里的组：`/jobs/:id/files/<组>/<文件名>`。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FileGroup {
    Output,
    Pages,
    Internal,
}

/// 新地址的 `<组>/<文件名>` → 文件。
pub(crate) fn named_file(group: FileGroup, name: &str, query: &JobFilesQuery) -> Result<JobFile, AppError> {
    match group {
        FileGroup::Output => output_file(name, query),
        FileGroup::Pages => page_file(name, query),
        FileGroup::Internal => internal_file(name),
    }
}

/// `output/<name>` → 文件。
fn output_file(name: &str, query: &JobFilesQuery) -> Result<JobFile, AppError> {
    if let Some(image) = name.strip_prefix(OCR_IMAGES_PREFIX) {
        return Ok(JobFile::OcrImage(image.to_string()));
    }
    Ok(match name {
        "translated.pdf" => JobFile::TranslatedPdf { watermark: query.wants_watermark() },
        "side-by-side.pdf" => JobFile::SideBySidePdf { watermark: query.wants_watermark() },
        "translated.docx" => JobFile::translated_docx(&crate::views::LayoutDocxQuery { dpi: query.dpi }, query.wants_watermark()),
        "ocr.md" => JobFile::OcrMarkdown,
        "ocr.zip" => JobFile::OcrMarkdownZip { include_job_dir: false },
        "all.zip" => JobFile::All,
        _ => return Err(not_found("output", name)),
    })
}

/// `pages/<页码>.jpg` → 译文那一页的预览图。原文页在书下面（`/documents/:id/files/pages/…`）。
fn page_file(name: &str, query: &JobFilesQuery) -> Result<JobFile, AppError> {
    let page = name
        .strip_suffix(".jpg")
        .and_then(|page| page.parse::<u32>().ok())
        .filter(|page| *page >= 1)
        .ok_or_else(|| not_found("pages", name))?;
    Ok(JobFile::page(
        page,
        &crate::views::PagePreviewQuery {
            kind: "translated".to_string(),
            width: query.width,
            dpi: query.dpi,
        },
    ))
}

/// `internal/<name>` → 产物清单里的那一项。
fn internal_file(name: &str) -> Result<JobFile, AppError> {
    INTERNAL_FILES
        .iter()
        .find(|(file_name, _)| *file_name == name)
        .map(|(_, key)| JobFile::Registered((*key).to_string()))
        .ok_or_else(|| not_found("internal", name))
}

#[derive(Debug, Serialize)]
pub struct JobFilesView {
    pub job_id: String,
    /// 这是第几次跑（重跑、重试阶段以后加一），和产物清单每一项的 `attempt` 一样。
    pub attempt: u32,
    /// 原文 PDF。它是书的文件：`url` 指向 `/documents/:id/files/source.pdf`；
    /// 查不到书编号就没有地址，`url` 是空串、`ready` 是 false。
    pub source: JobFileEntryView,
    pub output: Vec<JobFileEntryView>,
    pub pages: JobPagesView,
    /// 只有管理员（以及单机模式）能看到。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internal: Option<Vec<JobFileEntryView>>,
}

#[derive(Debug, Serialize)]
pub struct JobFileEntryView {
    pub name: String,
    pub url: String,
    pub content_type: String,
    /// 现在能不能取到。按需生成的文件，这里表示生成它要的东西都在。
    pub ready: bool,
    /// 按需生成：第一次请求时才生成，会慢一些。
    pub on_demand: bool,
    /// 已经在磁盘上的文件才有大小。
    pub size_bytes: Option<u64>,
    /// 产物登记表里的更新时间；登记表里没有（按需生成、还没生成）就是 null。
    pub updated_at: Option<String>,
    /// 哪个阶段产出的（登记表的 source_stage，例如 `ocr`、`translation`、`render`）；不知道就是 null。
    pub stage: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobPagesView {
    /// 把 `{page}` 换成页码（从 1 开始）。
    pub url_template: String,
    pub page_count: Option<i64>,
}

fn file_size(path: &Path) -> Option<u64> {
    std::fs::metadata(path).ok().filter(|meta| meta.is_file()).map(|meta| meta.len())
}

fn exists(path: Option<std::path::PathBuf>) -> Option<std::path::PathBuf> {
    path.filter(|path| path.is_file())
}

pub fn job_files_view(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    include_internal: bool,
    base_url: &str,
) -> Result<JobFilesView, AppError> {
    let files_path = format!("/api/v1/jobs/{}/files", job.job_id);
    let registry = list_registry_for_job(db, data_root, job)?;
    let registered = |key: &str| registry.iter().find(|item| item.artifact_key == key);
    // 登记表里这一项的更新时间和产出阶段。
    let provenance = |key: Option<&str>| {
        key.and_then(|key| registered(key))
            .map(|item| (Some(item.updated_at.clone()), item.source_stage.clone()))
            .unwrap_or((None, None))
    };
    let entry = |group: &str, name: &str, key: Option<&str>, content_type: &str, ready: bool, on_demand: bool, size: Option<u64>| {
        let (updated_at, stage) = provenance(key);
        JobFileEntryView {
            name: name.to_string(),
            url: to_absolute_url(base_url, &format!("{files_path}/{group}/{name}")),
            content_type: content_type.to_string(),
            ready,
            on_demand,
            size_bytes: size,
            updated_at,
            stage,
        }
    };
    let source = exists(resolve_source_pdf(job, data_root));
    let translated = exists(resolve_output_pdf(job, data_root));
    let markdown = exists(resolve_markdown_path(job, data_root));
    let job_root = resolve_job_root(job, data_root);

    let output = vec![
        entry("output", "translated.pdf", Some(ARTIFACT_KEY_TRANSLATED_PDF), "application/pdf", translated.is_some(), false,
            translated.as_deref().and_then(file_size)),
        entry("output", "side-by-side.pdf", None, "application/pdf",
            source.is_some() && translated.is_some(), true, None),
        entry("output", "translated.docx", None,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source.is_some() && job_root.is_some(), true, None),
        entry("output", "ocr.md", Some(ARTIFACT_KEY_MARKDOWN_RAW), "text/markdown; charset=utf-8", markdown.is_some(), false,
            markdown.as_deref().and_then(file_size)),
        entry("output", "ocr.zip", Some(ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP), "application/zip", markdown.is_some(), true, None),
        entry("output", "all.zip", None, "application/zip",
            matches!(job.status, JobStatusKind::Succeeded), true, None),
    ];

    let upload = job_upload_id(job).and_then(|id| db.get_upload(id).ok());
    let source_entry = {
        let (updated_at, stage) = provenance(Some(ARTIFACT_KEY_SOURCE_PDF));
        // 原文是书的文件。查不到书编号就没有地址可给（按任务取原文的旧地址 2026-10-18 删了）：
        // `url` 留空、`ready` 是 false。有原文的任务都会登记成书，实际只有原文文件不在的任务查不到。
        let document_id = book_document_id(db, job, upload.as_ref());
        JobFileEntryView {
            name: "source.pdf".to_string(),
            url: document_id
                .as_deref()
                .map(|document_id| to_absolute_url(base_url, &document_file_path(document_id, "source.pdf")))
                .unwrap_or_default(),
            content_type: "application/pdf".to_string(),
            ready: source.is_some() && document_id.is_some(),
            on_demand: false,
            size_bytes: source.as_deref().and_then(file_size),
            updated_at,
            stage,
        }
    };
    let pages = JobPagesView {
        url_template: to_absolute_url(base_url, &format!("{files_path}/pages/{{page}}.jpg")),
        page_count: SummaryCache::default().book_page_count(upload.as_ref(), job, data_root),
    };

    let internal = if include_internal {
        Some(
            INTERNAL_FILES
                .iter()
                .filter_map(|(name, key)| {
                    let item = registered(key)?;
                    Some(entry("internal", name, Some(key), &item.content_type, item.ready, false, item.size_bytes))
                })
                .collect(),
        )
    } else {
        None
    };

    let attempt = job
        .runtime
        .as_ref()
        .map(|runtime| runtime.retry_count.saturating_add(1))
        .unwrap_or(1);
    Ok(JobFilesView {
        job_id: job.job_id.clone(),
        attempt,
        source: source_entry,
        output,
        pages,
        internal,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query() -> JobFilesQuery {
        JobFilesQuery::default()
    }

    #[test]
    fn every_internal_name_maps_to_a_distinct_registry_key() {
        let mut keys: Vec<&str> = INTERNAL_FILES.iter().map(|(_, key)| *key).collect();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), INTERNAL_FILES.len());
        assert!(!keys.contains(&"layout_json"), "layout_json 和 provider_result_json 是同一个文件，只列一个");
    }

    #[test]
    fn names_resolve_to_files() {
        assert_eq!(output_file("translated.pdf", &query()).unwrap(), JobFile::TranslatedPdf { watermark: true });
        let plain = JobFilesQuery { watermark: Some("0".into()), ..query() };
        assert_eq!(output_file("translated.pdf", &plain).unwrap(), JobFile::TranslatedPdf { watermark: false });
        assert_eq!(output_file("side-by-side.pdf", &plain).unwrap(), JobFile::SideBySidePdf { watermark: false });
        assert!(matches!(output_file("translated.docx", &query()).unwrap(), JobFile::TranslatedDocx(options) if options.watermark));
        assert_eq!(
            output_file("ocr/images/page-1/fig.png", &query()).unwrap(),
            JobFile::OcrImage("page-1/fig.png".into())
        );
        assert_eq!(
            internal_file("ocr-provider/result.json").unwrap(),
            JobFile::Registered("provider_result_json".into())
        );
        assert!(page_file("3.jpg", &query()).is_ok());
    }

    #[test]
    fn unknown_names_are_404() {
        for result in [
            output_file("translated.PDF", &query()),
            output_file("../etc/passwd", &query()),
            page_file("3.png", &query()),
            page_file("x.jpg", &query()),
            page_file("0.jpg", &query()),
            internal_file("layout.json"),
        ] {
            assert!(matches!(result, Err(AppError::NotFound(_))));
        }
    }
}
