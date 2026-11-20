//! 任务文件的唯一出口：按名字（[`JobFile`]）找到文件，交给路由层发出去。
//!
//! 每种文件到哪找、什么类型、下载时叫什么，都只在这里写一次。下载接口（`/jobs/:id/files/…`、
//! 书的文件、AI 写的东西……）一律调 `JobDownloads::open`。
//! 加一种文件 = 在 `JobFile` 里加一个名字、在 `locate` 里加一个分支，不要再单开下载函数。
//!
//! AI 助手写的文件（画板）不在这里：`<job>/ai/` 是 AI 可写的目录，
//! 文件名的防护都在 `ai_board.rs`。

use std::path::PathBuf;

use retainpdf_api_base::error::AppError;
use crate::views::{LayoutDocxQuery, PagePreviewQuery};
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_files::{
    artifact_is_direct_downloadable, build_bundle_for_job, build_markdown_bundle_for_job,
    ensure_book_image, ensure_layout_docx, ensure_page_preview, ensure_side_by_side_pdf, ensure_watermarked_pdf,
    job_download_file_name, job_page_preview_file_name, job_upload_id, resolve_registry_artifact,
    BookImageKind, DownloadKind,
    LayoutDocxOptions, JOB_INTERNAL_FILES,
};
use retainpdf_core::storage_paths::{
    resolve_job_root, resolve_markdown_path, resolve_ocr_markdown_images_dir, resolve_output_pdf,
    resolve_source_pdf,
    ARTIFACT_KEY_SOURCE_PDF,
};

use crate::files::downloads::artifact_deps::derived_artifact_deps;
use crate::files::downloads::paths::{job_artifacts_dir, safe_markdown_image_path};
use crate::files::downloads::pdf::linearized_pdf_or_original;
use crate::summary_loaders::SummaryCache;
use crate::files::downloads::{DownloadJobsDeps, FileDownload};

const DOCX_CONTENT_TYPE: &str =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MARKDOWN_CONTENT_TYPE: &str = "text/markdown; charset=utf-8";
/// 「还没产出」报错里用的对外文件名。
const SOURCE_PDF: &str = "source.pdf";
const TRANSLATED_PDF: &str = "translated.pdf";
/// 封面、缩略图按源 PDF 首页生成，一本书不变，浏览器缓存一天。
const IMAGE_CACHE: &str = "private, max-age=86400";
/// 译文页预览：译文 PDF 重渲染以后同一个地址的图会变，不能让浏览器直接用缓存。
/// 每次带着 ETag / Last-Modified 来问，没变回 304。
const TRANSLATED_PAGE_CACHE: &str = "private, max-age=0, must-revalidate";

/// 任务能取的每一种文件。
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JobFile {
    /// 原文 PDF。
    SourcePdf,
    /// 译文 PDF。`watermark`：右下角盖「logo + RetainPDF」（下载默认带，按需生成）。
    TranslatedPdf { watermark: bool },
    /// 中英对照 PDF（按需生成）。
    SideBySidePdf { watermark: bool },
    /// 译文 Word（按需生成，每种清晰度一份）。
    TranslatedDocx(LayoutDocxOptions),
    /// 原文 Markdown（OCR 识别结果，不是译文）。
    OcrMarkdown,
    /// 原文 Markdown + 图片打包（按需生成）。
    OcrMarkdownZip { include_job_dir: bool },
    /// Markdown 引用的一张图片，`images/` 下的相对路径。
    OcrImage(String),
    /// 全部成品打包（按需生成，只给成功的任务）。
    All,
    /// 封面、缩略图（按需生成）。
    Cover,
    Thumbnail,
    /// 单页预览图（按需生成）。
    Page(PageSpec),
    /// 产物清单里的其它名字：排查用的中间产物，以及不能直接下载的目录。
    Registered(String),
}

impl JobFile {

    /// 清晰度夹在可用区间里：太低看不清背景，太高单页几十 MB，整本能把浏览器拖垮。
    pub fn translated_docx(query: &LayoutDocxQuery, watermark: bool) -> Self {
        let mut options = LayoutDocxOptions { watermark, ..LayoutDocxOptions::default() };
        if let Some(dpi) = query.dpi {
            options.dpi = dpi.clamp(72, 300);
        }
        Self::TranslatedDocx(options)
    }

    pub fn page(page: u32, query: &PagePreviewQuery) -> Self {
        Self::Page(PageSpec {
            kind: query.kind.trim().to_ascii_lowercase(),
            page,
            width_px: query.width.unwrap_or(1200).clamp(240, 2400),
            dpi: query.dpi.unwrap_or(0).min(300),
        })
    }

    /// 同一份产物同时被请求时只生成一次：键里带上决定产物内容的全部参数。
    fn generation_key(&self) -> String {
        match self {
            Self::SourcePdf => "source.pdf".into(),
            Self::TranslatedPdf { watermark } => format!("translated.pdf:wm={watermark}"),
            Self::SideBySidePdf { watermark } => format!("side-by-side.pdf:wm={watermark}"),
            Self::TranslatedDocx(options) => format!("translated.docx:{}", options.cache_suffix()),
            Self::OcrMarkdown => "ocr.md".into(),
            Self::OcrMarkdownZip { include_job_dir } => format!("ocr.zip:{include_job_dir}"),
            Self::OcrImage(path) => format!("ocr-image:{path}"),
            Self::All => "all.zip".into(),
            Self::Cover => "cover".into(),
            Self::Thumbnail => "thumbnail".into(),
            Self::Page(spec) => spec.generation_key(),
            Self::Registered(key) => format!("artifact:{key}"),
        }
    }
}

#[derive(Clone, Copy)]
enum PagePreviewKind {
    Source,
    Translated,
}

impl PagePreviewKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Translated => "translated",
        }
    }
}

fn preview_kind(kind: &str) -> Result<PagePreviewKind, AppError> {
    match kind {
        "source" => Ok(PagePreviewKind::Source),
        "translated" => Ok(PagePreviewKind::Translated),
        _ => Err(AppError::bad_request("preview kind must be source or translated")),
    }
}

/// 单页预览：参数在构造时就规整好，生成键和磁盘上的文件名用同一组值。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PageSpec {
    kind: String,
    page: u32,
    width_px: u32,
    dpi: u32,
}

impl PageSpec {
    fn generation_key(&self) -> String {
        serde_json::to_string(&("page", &self.kind, self.page, self.width_px, self.dpi))
            .expect("preview key contains only strings and integers")
    }
}

/// 在浏览器里打开还是下载。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Disposition {
    /// `inline; filename=…`：照常在浏览器里打开，另存为时文件名是对的。
    Inline,
    /// `attachment; filename=…`：直接下载。
    Attachment,
}

pub(super) fn generation_key(job_id: &str, file: &JobFile) -> String {
    format!("{job_id}:{}", file.generation_key())
}

/// 找到的文件：路径、类型、给用户的文件名（排查用的文件用它在磁盘上的原名）。
struct Located {
    path: PathBuf,
    content_type: String,
    name: Option<String>,
    job_id_header: bool,
    cache_control: Option<&'static str>,
}

impl Located {
    fn new(path: PathBuf, content_type: impl Into<String>) -> Self {
        Self {
            path,
            content_type: content_type.into(),
            name: None,
            job_id_header: false,
            cache_control: None,
        }
    }

    fn named(mut self, name: Option<String>) -> Self {
        self.name = name;
        self
    }
}

pub(super) fn open_job_file(
    deps: &DownloadJobsDeps<'_>,
    job_id: &str,
    file: &JobFile,
    disposition: Disposition,
) -> Result<FileDownload, AppError> {
    let job = retainpdf_api_base::job_loading::load_supported_job(deps.db, deps.data_root, job_id)?;
    let located = locate(deps, &job, file)?;
    let mut download = FileDownload::new(located.path, located.content_type, None);
    if let Some(name) = located.name {
        download = match disposition {
            Disposition::Inline => download.with_inline_name(name),
            Disposition::Attachment => FileDownload {
                download_name: Some(name),
                ..download
            },
        };
    }
    if located.job_id_header {
        download = download.with_job_id_header(job.job_id.clone());
    }
    download.cache_control = located.cache_control;
    Ok(download)
}

fn user_file_name(deps: &DownloadJobsDeps<'_>, job: &JobSnapshot, kind: DownloadKind) -> Option<String> {
    Some(job_download_file_name(deps.db, job, kind))
}

/// 任务在、文件还没产出：404 + `reason: not_ready`，文案 `<名字> not ready`（`what` 用对外的文件名）。
fn require_file(path: Option<PathBuf>, what: &str) -> Result<PathBuf, AppError> {
    path.filter(|path| path.is_file()).ok_or_else(|| AppError::not_ready(what))
}

/// `internal/` 组的对外文件名（报错用）；表里没有的退回产物键。
fn internal_file_name(key: &str) -> String {
    JOB_INTERNAL_FILES
        .iter()
        .find(|(_, registered)| *registered == key)
        .map_or(key, |(name, _)| *name)
        .to_string()
}

fn locate(deps: &DownloadJobsDeps<'_>, job: &JobSnapshot, file: &JobFile) -> Result<Located, AppError> {
    let data_root = deps.data_root;
    match file {
        JobFile::SourcePdf => {
            let path = require_file(resolve_source_pdf(job, data_root), SOURCE_PDF)?;
            let path = linearized_pdf_or_original(deps, job, &path, ARTIFACT_KEY_SOURCE_PDF)?;
            Ok(Located::new(path, "application/pdf")
                .named(user_file_name(deps, job, DownloadKind::Source)))
        }
        JobFile::TranslatedPdf { watermark } => {
            let path = require_file(resolve_output_pdf(job, data_root), TRANSLATED_PDF)?;
            let (path, label) = if *watermark {
                (ensure_watermarked_pdf(derived_artifact_deps(deps), data_root, job, &path, "output")?, "output-watermarked")
            } else {
                (path, "output")
            };
            let path = linearized_pdf_or_original(deps, job, &path, label)?;
            Ok(Located::new(path, "application/pdf")
                .named(user_file_name(deps, job, DownloadKind::Translated)))
        }
        JobFile::SideBySidePdf { watermark } => {
            let source_pdf = require_file(resolve_source_pdf(job, data_root), SOURCE_PDF)?;
            let translated_pdf = require_file(resolve_output_pdf(job, data_root), TRANSLATED_PDF)?;
            let output_pdf = ensure_side_by_side_pdf(
                derived_artifact_deps(deps),
                data_root,
                job,
                &source_pdf,
                &translated_pdf,
            )?;
            let (output_pdf, label) = if *watermark {
                (ensure_watermarked_pdf(derived_artifact_deps(deps), data_root, job, &output_pdf, "side-by-side")?, "side-by-side-watermarked")
            } else {
                (output_pdf, "side-by-side")
            };
            let path = linearized_pdf_or_original(deps, job, &output_pdf, label)?;
            Ok(Located::new(path, "application/pdf")
                .named(user_file_name(deps, job, DownloadKind::SideBySide)))
        }
        JobFile::TranslatedDocx(options) => {
            let job_root = resolve_job_root(job, data_root)
                .ok_or_else(|| AppError::not_ready("translated.docx"))?;
            let source_pdf = require_file(resolve_source_pdf(job, data_root), SOURCE_PDF)?;
            // 译文 PDF 是**可选**的：有它就从里面读回收敛后的字号和行距（最准），没有就走
            // 阅读器那套字号收敛（html_fit）。只翻译没渲染的任务一样导得出来。
            let translated_pdf = resolve_output_pdf(job, data_root).filter(|path| path.is_file());
            let path = ensure_layout_docx(
                derived_artifact_deps(deps),
                data_root,
                job,
                &job_root,
                &source_pdf,
                translated_pdf.as_deref(),
                *options,
            )?;
            Ok(Located::new(path, DOCX_CONTENT_TYPE)
                .named(user_file_name(deps, job, DownloadKind::Layout)))
        }
        JobFile::OcrMarkdown => {
            let path = resolve_markdown_path(job, data_root).ok_or_else(|| AppError::not_ready("ocr.md"))?;
            Ok(Located::new(path, MARKDOWN_CONTENT_TYPE)
                .named(user_file_name(deps, job, DownloadKind::OcrMarkdown)))
        }
        JobFile::OcrMarkdownZip { include_job_dir } => {
            let (item, path) =
                build_markdown_bundle_for_job(deps.db, data_root, job, *include_job_dir)?;
            Ok(Located::new(path, item.content_type)
                .named(user_file_name(deps, job, DownloadKind::MarkdownBundle)))
        }
        JobFile::OcrImage(relative) => {
            // 图片目录还没有 = Markdown 还没产出；目录在、要的那张不在 = 没有这个文件（普通 404）。
            // 复用 OCR 的任务，图片在产出 OCR 的那个任务下面；阅读页区域给的就是这个地址。
            let images_dir = resolve_ocr_markdown_images_dir(job, data_root)
                .ok_or_else(|| AppError::not_ready("ocr/images"))?;
            let path = images_dir.join(safe_markdown_image_path(relative)?);
            if !path.is_file() {
                return Err(AppError::not_found(format!("markdown image not found: {relative}")));
            }
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            Ok(Located::new(path, mime.as_ref()))
        }
        JobFile::All => {
            // 只给成功的任务打包；没成功（排队、在跑、失败、取消）就是还没产出，和其它文件一样 404。
            if !matches!(job.status, JobStatusKind::Succeeded) {
                return Err(AppError::not_ready("all.zip"));
            }
            let path = build_bundle_for_job(deps.db, data_root, deps.downloads_dir, job)?;
            Ok(Located {
                job_id_header: true,
                ..Located::new(path, "application/zip")
                    .named(user_file_name(deps, job, DownloadKind::Bundle))
            })
        }
        JobFile::Cover | JobFile::Thumbnail => {
            let kind = match file {
                JobFile::Cover => BookImageKind::Cover,
                _ => BookImageKind::Thumbnail,
            };
            let source_pdf = resolve_source_pdf(job, data_root).ok_or_else(|| AppError::not_ready(SOURCE_PDF))?;
            let path = ensure_book_image(
                derived_artifact_deps(deps),
                data_root,
                job,
                &source_pdf,
                kind,
            )?;
            Ok(Located {
                cache_control: Some(IMAGE_CACHE),
                ..Located::new(path, "image/jpeg")
            })
        }
        JobFile::Page(spec) => {
            let kind = preview_kind(&spec.kind)?;
            let pdf = match kind {
                PagePreviewKind::Source => {
                    resolve_source_pdf(job, data_root).ok_or_else(|| AppError::not_ready(SOURCE_PDF))?
                }
                PagePreviewKind::Translated => {
                    resolve_output_pdf(job, data_root).ok_or_else(|| AppError::not_ready(TRANSLATED_PDF))?
                }
            };
            let page_index = spec
                .page
                .checked_sub(1)
                .ok_or_else(|| AppError::bad_request("page must be 1-based"))?;
            // 页码超出页数：不用起渲染进程，直接 404（和 `pages/0.jpg` 一样的报错）。
            // 页数用 `/files` 清单里 `pages.page_count` 同一份规则；查不到页数就交给渲染脚本判断。
            let upload = job_upload_id(job).and_then(|id| deps.db.get_upload(id).ok());
            let page_count = SummaryCache::default().book_page_count(upload.as_ref(), job, data_root);
            if page_count.is_some_and(|count| count > 0 && i64::from(spec.page) > count) {
                return Err(AppError::not_found(format!("no such file: pages/{}.jpg", spec.page)));
            }
            let output_path = job_artifacts_dir(deps, job)?.join(job_page_preview_file_name(
                kind.as_str(),
                spec.page,
                spec.width_px,
                spec.dpi,
            ));
            let path = ensure_page_preview(
                derived_artifact_deps(deps),
                &output_path,
                &pdf,
                page_index,
                spec.width_px,
                spec.dpi,
            )?;
            let cache_control = match kind {
                PagePreviewKind::Translated => TRANSLATED_PAGE_CACHE,
                PagePreviewKind::Source => IMAGE_CACHE,
            };
            Ok(Located {
                cache_control: Some(cache_control),
                ..Located::new(path, "image/jpeg")
            })
        }
        JobFile::Registered(key) => {
            // 产物清单里还没登记 = 还没产出（名字本身不认识的，在 catalog 里就是普通 404）。
            let Some((item, path)) = resolve_registry_artifact(deps.db, data_root, job, key)? else {
                return Err(AppError::not_ready(&internal_file_name(key)));
            };
            if !artifact_is_direct_downloadable(&item) {
                return Err(AppError::conflict(format!(
                    "artifact is a directory and cannot be streamed directly: {key}"
                )));
            }
            if !item.ready || !path.is_file() {
                return Err(AppError::not_ready(&internal_file_name(key)));
            }
            Ok(Located::new(path, item.content_type).named(item.file_name))
        }
    }
}
