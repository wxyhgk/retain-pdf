use std::path::PathBuf;

use crate::services::jobs::deps::QueryJobsDeps;

// Keep this file as the small public facade for job downloads. Concrete
// handlers live in submodules so PDF, markdown, preview, and artifact behavior
// can evolve without turning one route helper into another large grab bag.
mod artifact_deps;
mod artifacts;
mod documents;
mod markdown;
mod paths;
mod pdf;
mod previews;
mod side_by_side;

pub(crate) use artifacts::{bundle_download, registered_artifact_download};
pub(crate) use documents::{document_download, DocumentDownloadKind};
pub(crate) use markdown::{markdown_document_view, markdown_download, markdown_image_download};
pub(crate) use previews::{cover_download, page_preview_download, thumbnail_download};
pub(crate) use side_by_side::side_by_side_pdf_download;

#[derive(Clone, Debug)]
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
