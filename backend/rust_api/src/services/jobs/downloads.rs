use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::{
    to_absolute_url, JobSnapshot, JobStatusKind, MarkdownDocumentView, MarkdownImageView,
    PagePreviewQuery,
};
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

mod paths;
mod pdf;
mod previews;

use paths::{job_artifacts_dir, safe_markdown_image_path};
use pdf::linearized_pdf_or_original;
use previews::{
    preview_kind, render_book_image, render_pdf_page_preview, BookImageKind, PagePreviewKind,
};

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

const MARKDOWN_IMAGE_LINK_RE: &str = r#"!\[([^\]]*)\]\((images/[^)]+)\)"#;

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
    let download_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|s| s.to_string());
    Ok(FileDownload::new(path, content_type, download_name))
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

pub async fn markdown_document_view(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    base_url: &str,
) -> Result<MarkdownDocumentView, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let markdown_path = resolve_markdown_path(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", job.job_id);
    let markdown_path_url = format!("/api/v1/jobs/{}/markdown/document", job.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", job.job_id);
    let images = markdown_images_view(deps, &job, base_url)?;
    let content_with_absolute_image_urls = rewrite_markdown_image_links_to_absolute_urls(
        &content,
        &job.job_id,
        base_url,
    );
    Ok(MarkdownDocumentView {
        job_id: job.job_id.clone(),
        ready: true,
        content,
        content_with_absolute_image_urls,
        markdown_path: markdown_path_url.clone(),
        markdown_url: to_absolute_url(base_url, &markdown_path_url),
        raw_path: raw_path.clone(),
        raw_url: to_absolute_url(base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: to_absolute_url(base_url, &images_base_path),
        images,
    })
}

fn markdown_images_view(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    base_url: &str,
) -> Result<Vec<MarkdownImageView>, AppError> {
    let Some(images_dir) = resolve_markdown_images_dir(job, deps.data_root) else {
        return Ok(Vec::new());
    };
    let mut images = Vec::new();
    for entry in walkdir::WalkDir::new(&images_dir)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.path();
        let Ok(relative) = path.strip_prefix(&images_dir) else {
            continue;
        };
        let relative_path = relative.to_string_lossy().replace('\\', "/");
        let resource_path = format!(
            "/api/v1/jobs/{}/markdown/images/{}",
            job.job_id,
            url_path_escape(&relative_path)
        );
        let metadata = path.metadata().ok();
        images.push(MarkdownImageView {
            path: format!("images/{relative_path}"),
            url: to_absolute_url(base_url, &resource_path),
            content_type: mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string(),
            size_bytes: metadata.map(|item| item.len()),
        });
    }
    images.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(images)
}

fn rewrite_markdown_image_links_to_absolute_urls(
    content: &str,
    job_id: &str,
    base_url: &str,
) -> String {
    let re = regex::Regex::new(MARKDOWN_IMAGE_LINK_RE).expect("valid markdown image regex");
    re.replace_all(content, |captures: &regex::Captures<'_>| {
        let alt = &captures[1];
        let path = &captures[2];
        let relative = path.strip_prefix("images/").unwrap_or(path);
        let resource_path = format!(
            "/api/v1/jobs/{job_id}/markdown/images/{}",
            url_path_escape(relative)
        );
        format!("![{alt}]({})", to_absolute_url(base_url, &resource_path))
    })
    .into_owned()
}

fn url_path_escape(path: &str) -> String {
    path.split('/')
        .map(percent_encode_path_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
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
