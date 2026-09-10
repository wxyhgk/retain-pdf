//! Document source PDF / cover / thumbnail media.

use std::path::PathBuf;

use crate::error::AppError;
use crate::services::derived_artifacts;
use crate::services::derived_artifacts::preview::BookImageKind;

use super::documents::require_document_upload;
use super::LibraryDeps;

/// Resolved file payload for route-layer streaming (`stream_file`).
#[derive(Debug, Clone)]
pub struct DocumentFileDownload {
    pub path: PathBuf,
    pub content_type: &'static str,
    pub download_name: Option<String>,
}

fn document_source_pdf_path(upload: &crate::models::domain::UploadRecord) -> PathBuf {
    PathBuf::from(&upload.stored_path)
}

fn ensure_document_image(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    source_pdf: &std::path::Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let artifact_deps = derived_artifacts::DerivedArtifactDeps::new(deps.python_bin);
    derived_artifacts::preview::ensure_document_book_image(
        artifact_deps,
        deps.data_root,
        document_id,
        source_pdf,
        kind,
    )
}

pub fn document_source_pdf(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    let (document, upload) = require_document_upload(deps, document_id)?;
    let path = document_source_pdf_path(&upload);
    let download_name = if document.source_filename.trim().is_empty() {
        format!("{document_id}.pdf")
    } else {
        document.source_filename.clone()
    };
    Ok(DocumentFileDownload {
        path,
        content_type: "application/pdf",
        download_name: Some(download_name),
    })
}

pub fn document_cover(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    let (_document, upload) = require_document_upload(deps, document_id)?;
    let source_pdf = document_source_pdf_path(&upload);
    let path = ensure_document_image(deps, document_id, &source_pdf, BookImageKind::Cover)?;
    Ok(DocumentFileDownload {
        path,
        content_type: "image/jpeg",
        download_name: None,
    })
}

pub fn document_thumbnail(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    let (_document, upload) = require_document_upload(deps, document_id)?;
    let source_pdf = document_source_pdf_path(&upload);
    let path = ensure_document_image(deps, document_id, &source_pdf, BookImageKind::Thumbnail)?;
    Ok(DocumentFileDownload {
        path,
        content_type: "image/jpeg",
        download_name: None,
    })
}
