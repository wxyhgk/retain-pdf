use std::path::{Component, Path, PathBuf};

use crate::error::AppError;
use crate::models::{JobSnapshot, JobStatusKind, PagePreviewQuery};
use crate::services::artifacts::{
    artifact_is_direct_downloadable, build_bundle_for_job, build_markdown_bundle_for_job,
    resolve_registry_artifact,
};
use crate::storage_paths::{
    resolve_markdown_images_dir, resolve_markdown_path, resolve_output_pdf, resolve_source_pdf,
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_SOURCE_PDF, ARTIFACT_KEY_TRANSLATED_PDF,
};

use super::creation::context::QueryJobsDeps;
use super::presentation::load_supported_job;

#[derive(Debug)]
pub struct FileDownload {
    pub path: PathBuf,
    pub content_type: String,
    pub download_name: Option<String>,
    pub job_id_header: Option<String>,
}

impl FileDownload {
    pub fn new(
        path: PathBuf,
        content_type: impl Into<String>,
        download_name: Option<String>,
    ) -> Self {
        Self {
            path,
            content_type: content_type.into(),
            download_name,
            job_id_header: None,
        }
    }

    pub fn with_job_id_header(mut self, job_id: impl Into<String>) -> Self {
        self.job_id_header = Some(job_id.into());
        self
    }
}

#[derive(Debug)]
pub struct MarkdownDownload {
    pub job_id: String,
    pub content: String,
}

pub fn document_download(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    resolve_path: impl Fn(&JobSnapshot, &Path) -> Option<PathBuf>,
    not_ready_label: &str,
    content_type: &str,
) -> Result<FileDownload, AppError> {
    let path = resolve_path(job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("{not_ready_label}: {}", job.job_id)))?;
    let path = if content_type == "application/pdf" {
        linearized_pdf_or_original(deps, job, &path, "output")?
    } else {
        path
    };
    Ok(FileDownload::new(path, content_type, None))
}

pub fn page_preview_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    page: u32,
    query: &PagePreviewQuery,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let source_pdf = match preview_kind(&query.kind)? {
        PagePreviewKind::Source => resolve_source_pdf(&job, deps.data_root)
            .ok_or_else(|| AppError::not_found(format!("source pdf not ready: {}", job.job_id)))?,
        PagePreviewKind::Translated => {
            resolve_output_pdf(&job, deps.data_root).ok_or_else(|| {
                AppError::not_found(format!("translated pdf not ready: {}", job.job_id))
            })?
        }
    };
    let page_index = page
        .checked_sub(1)
        .ok_or_else(|| AppError::bad_request("page must be 1-based"))?;
    let width_px = query.width.unwrap_or(1200).clamp(240, 2400);
    let dpi = query.dpi.unwrap_or(0).min(300);
    let output_dir = job_artifacts_dir(deps, &job)?;
    let output_path = output_dir.join(format!(
        "preview-{}-p{:04}-w{}-d{}.jpg",
        preview_kind(&query.kind)?.as_str(),
        page,
        width_px,
        dpi
    ));
    if output_path.exists() && output_path.is_file() {
        return Ok(FileDownload::new(output_path, "image/jpeg", None));
    }
    render_pdf_page_preview(
        deps.replay.python_bin,
        &source_pdf,
        &output_path,
        page_index,
        width_px,
        dpi,
    )?;
    Ok(FileDownload::new(output_path, "image/jpeg", None))
}

pub fn cover_download(deps: &QueryJobsDeps<'_>, job_id: &str) -> Result<FileDownload, AppError> {
    let path = render_book_image(deps, job_id, BookImageKind::Cover)?;
    Ok(FileDownload::new(path, "image/jpeg", None))
}

pub fn thumbnail_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
) -> Result<FileDownload, AppError> {
    let path = render_book_image(deps, job_id, BookImageKind::Thumbnail)?;
    Ok(FileDownload::new(path, "image/jpeg", None))
}

pub async fn markdown_download(
    deps: &QueryJobsDeps<'_>,
    job_id: String,
) -> Result<MarkdownDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, &job_id)?;
    let markdown_path = resolve_markdown_path(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    Ok(MarkdownDownload {
        job_id: job.job_id.clone(),
        content,
    })
}

pub fn markdown_image_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    path: &str,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let images_dir = resolve_markdown_images_dir(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown images not found: {job_id}")))?;
    let relative_path = safe_markdown_image_path(path)?;
    let file_path = images_dir.join(relative_path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(AppError::not_found(format!(
            "markdown image not found: {path}"
        )));
    }
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    Ok(FileDownload::new(file_path, mime.as_ref(), None))
}

fn safe_markdown_image_path(path: &str) -> Result<PathBuf, AppError> {
    let raw = Path::new(path);
    if raw.is_absolute() {
        return Err(AppError::bad_request(
            "absolute markdown image path is not allowed",
        ));
    }
    let mut clean = PathBuf::new();
    for component in raw.components() {
        match component {
            Component::Normal(part) => clean.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::bad_request(
                    "parent-relative markdown image path is not allowed",
                ));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(AppError::bad_request("markdown image path is empty"));
    }
    Ok(clean)
}

#[derive(Clone, Copy)]
enum BookImageKind {
    Cover,
    Thumbnail,
}

impl BookImageKind {
    fn file_name(self) -> &'static str {
        match self {
            Self::Cover => "cover.jpg",
            Self::Thumbnail => "thumbnail.jpg",
        }
    }

    fn width_px(self) -> u32 {
        match self {
            Self::Cover => 900,
            Self::Thumbnail => 360,
        }
    }
}

fn render_book_image(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let source_pdf = crate::storage_paths::resolve_source_pdf(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("source pdf not ready: {}", job.job_id)))?;
    let output_dir = deps
        .data_root
        .join("jobs")
        .join(&job.job_id)
        .join("artifacts");
    std::fs::create_dir_all(&output_dir)?;
    let output_path = output_dir.join(kind.file_name());
    if output_path.exists() && output_path.is_file() {
        return Ok(output_path);
    }

    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
width_px = int(sys.argv[3])

with fitz.open(source) as doc:
    if doc.page_count < 1:
        raise RuntimeError("source pdf has no pages")
    page = doc[0]
    scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    pix.save(output)
"#;
    let status = std::process::Command::new(deps.replay.python_bin)
        .arg("-c")
        .arg(script)
        .arg(&source_pdf)
        .arg(&output_path)
        .arg(kind.width_px().to_string())
        .status()
        .map_err(|error| AppError::internal(format!("failed to render book image: {error}")))?;
    if !status.success() || !output_path.exists() {
        return Err(AppError::internal(format!(
            "failed to render book image for {}",
            job.job_id
        )));
    }
    Ok(output_path)
}

pub fn bundle_download(deps: &QueryJobsDeps<'_>, job_id: &str) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    if !matches!(job.status, JobStatusKind::Succeeded) {
        return Err(AppError::conflict("job is not finished successfully"));
    }
    let zip_path = build_bundle_for_job(deps.db, deps.data_root, deps.downloads_dir, &job)?;
    Ok(
        FileDownload::new(zip_path, "application/zip", Some(format!("{job_id}.zip")))
            .with_job_id_header(job_id),
    )
}

pub fn registered_artifact_download(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    artifact_key: &str,
    include_job_dir: bool,
) -> Result<FileDownload, AppError> {
    if artifact_key == ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP {
        let (item, path) =
            build_markdown_bundle_for_job(deps.db, deps.data_root, job, include_job_dir)?;
        return Ok(FileDownload::new(path, item.content_type, item.file_name));
    }
    let Some((item, path)) = resolve_registry_artifact(deps.db, deps.data_root, job, artifact_key)?
    else {
        return Err(AppError::not_found(format!(
            "artifact not found: {}/{artifact_key}",
            job.job_id
        )));
    };
    if !artifact_is_direct_downloadable(&item) {
        return Err(AppError::conflict(format!(
            "artifact is a directory and cannot be streamed directly: {artifact_key}"
        )));
    }
    if !item.ready || !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "artifact not ready: {}/{artifact_key}",
            job.job_id
        )));
    }
    let path = if item.content_type == "application/pdf"
        && matches!(
            artifact_key,
            ARTIFACT_KEY_SOURCE_PDF | ARTIFACT_KEY_TRANSLATED_PDF
        ) {
        linearized_pdf_or_original(deps, job, &path, artifact_key)?
    } else {
        path
    };
    Ok(FileDownload::new(path, item.content_type, item.file_name))
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
    match kind.trim().to_ascii_lowercase().as_str() {
        "source" => Ok(PagePreviewKind::Source),
        "translated" => Ok(PagePreviewKind::Translated),
        _ => Err(AppError::bad_request(
            "preview kind must be source or translated",
        )),
    }
}

fn job_artifacts_dir(deps: &QueryJobsDeps<'_>, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let output_dir = deps
        .data_root
        .join("jobs")
        .join(&job.job_id)
        .join("artifacts");
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

fn linearized_pdf_or_original(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    input_pdf: &Path,
    label: &str,
) -> Result<PathBuf, AppError> {
    if !input_pdf.exists() || !input_pdf.is_file() {
        return Ok(input_pdf.to_path_buf());
    }
    let output_dir = job_artifacts_dir(deps, job)?;
    let safe_label = label.replace('/', "_");
    let output_pdf = output_dir.join(format!("{safe_label}.linearized.pdf"));
    let input_meta = std::fs::metadata(input_pdf)?;
    if output_pdf.exists() && output_pdf.is_file() {
        let output_meta = std::fs::metadata(&output_pdf)?;
        if output_meta.modified().ok() >= input_meta.modified().ok() {
            return Ok(output_pdf);
        }
    }
    let tmp_pdf = output_pdf.with_extension("pdf.tmp");
    let linearized = linearize_pdf_with_qpdf(input_pdf, &tmp_pdf)?;
    if !linearized || !tmp_pdf.exists() {
        let _ = std::fs::remove_file(&tmp_pdf);
        return Ok(input_pdf.to_path_buf());
    }
    std::fs::rename(&tmp_pdf, &output_pdf)?;
    Ok(output_pdf)
}

fn linearize_pdf_with_qpdf(input_pdf: &Path, output_pdf: &Path) -> Result<bool, AppError> {
    let Some(qpdf) = find_tool("qpdf") else {
        return Ok(false);
    };
    let status = std::process::Command::new(qpdf)
        .arg("--linearize")
        .arg(input_pdf)
        .arg(output_pdf)
        .status()
        .map_err(|error| AppError::internal(format!("failed to run qpdf: {error}")))?;
    Ok(status.success() && output_pdf.exists())
}

fn render_pdf_page_preview(
    python_bin: &str,
    source_pdf: &Path,
    output_path: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
) -> Result<(), AppError> {
    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
page_index = int(sys.argv[3])
width_px = int(sys.argv[4])
dpi = int(sys.argv[5])

with fitz.open(source) as doc:
    if page_index < 0 or page_index >= doc.page_count:
        raise RuntimeError(f"page out of range: {page_index + 1}/{doc.page_count}")
    page = doc[page_index]
    if dpi > 0:
        scale = dpi / 72.0
    else:
        scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    pix.save(output, jpg_quality=82)
"#;
    let status = std::process::Command::new(python_bin)
        .arg("-c")
        .arg(script)
        .arg(source_pdf)
        .arg(output_path)
        .arg(page_index.to_string())
        .arg(width_px.to_string())
        .arg(dpi.to_string())
        .status()
        .map_err(|error| AppError::internal(format!("failed to render page preview: {error}")))?;
    if !status.success() || !output_path.exists() {
        return Err(AppError::internal("failed to render page preview"));
    }
    Ok(())
}

fn find_tool(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.exists() && candidate.is_file())
}
