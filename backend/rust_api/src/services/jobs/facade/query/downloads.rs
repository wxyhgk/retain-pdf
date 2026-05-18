use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::PagePreviewQuery;
use crate::services::jobs::downloads::{
    bundle_download, cover_download, document_download, markdown_download, markdown_image_download,
    page_preview_download, thumbnail_download, FileDownload, MarkdownDownload,
};

use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn download_job_document(
        &self,
        job_id: &str,
        ocr_only: bool,
        resolve_path: impl Fn(&crate::models::JobSnapshot, &Path) -> Option<PathBuf>,
        not_ready_label: &str,
        content_type: &str,
    ) -> Result<FileDownload, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        document_download(
            &self.query,
            &job,
            resolve_path,
            not_ready_label,
            content_type,
        )
    }

    pub async fn markdown_document(&self, job_id: String) -> Result<MarkdownDownload, AppError> {
        markdown_download(&self.query, job_id).await
    }

    pub fn markdown_image_download(
        &self,
        job_id: &str,
        path: &str,
    ) -> Result<FileDownload, AppError> {
        markdown_image_download(&self.query, job_id, path)
    }

    pub fn cover_download(&self, job_id: &str) -> Result<FileDownload, AppError> {
        cover_download(&self.query, job_id)
    }

    pub fn thumbnail_download(&self, job_id: &str) -> Result<FileDownload, AppError> {
        thumbnail_download(&self.query, job_id)
    }

    pub fn page_preview_download(
        &self,
        job_id: &str,
        page: u32,
        query: &PagePreviewQuery,
    ) -> Result<FileDownload, AppError> {
        page_preview_download(&self.query, job_id, page, query)
    }

    pub async fn bundle_download(&self, job_id: &str) -> Result<FileDownload, AppError> {
        let _guard = self.query.downloads_lock.lock().await;
        bundle_download(&self.query, job_id)
    }
}
