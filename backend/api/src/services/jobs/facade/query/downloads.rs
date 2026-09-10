use crate::error::AppError;
use crate::models::api::{MarkdownDocumentView, PagePreviewQuery};
use crate::services::jobs::downloads::{
    bundle_download, cover_download, document_download, markdown_document_view, markdown_download,
    markdown_image_download, page_preview_download, side_by_side_pdf_download, thumbnail_download,
    DocumentDownloadKind, FileDownload, MarkdownDownload,
};

use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub(crate) async fn download_job_document(
        &self,
        job_id: &str,
        ocr_only: bool,
        kind: DocumentDownloadKind,
    ) -> Result<FileDownload, AppError> {
        let deps = self.query.owned();
        let job_id = job_id.to_owned();
        let label = match kind {
            DocumentDownloadKind::OutputPdf => "output",
            DocumentDownloadKind::NormalizedDocument => "normalized",
            DocumentDownloadKind::NormalizationReport => "normalization-report",
        };
        self.query
            .download_generation
            .run(format!("{job_id}:document:{label}:{ocr_only}"), move || {
                let deps = deps.borrowed();
                let job = if ocr_only {
                    crate::services::jobs::query::load_ocr_job_with_supported_layout(
                        deps.db,
                        deps.data_root,
                        &job_id,
                    )?
                } else {
                    crate::services::jobs::query::load_supported_job(
                        deps.db,
                        deps.data_root,
                        &job_id,
                    )?
                };
                document_download(&deps, &job, kind)
            })
            .await
    }

    pub async fn markdown_document(&self, job_id: String) -> Result<MarkdownDownload, AppError> {
        markdown_download(&self.query, job_id).await
    }

    pub async fn markdown_document_view(
        &self,
        job_id: &str,
        base_url: &str,
    ) -> Result<MarkdownDocumentView, AppError> {
        markdown_document_view(&self.query, job_id, base_url).await
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

    pub async fn side_by_side_pdf_download(&self, job_id: &str) -> Result<FileDownload, AppError> {
        let deps = self.query.owned();
        let job_id = job_id.to_owned();
        self.query
            .download_generation
            .run(format!("{job_id}:side-by-side"), move || {
                side_by_side_pdf_download(&deps.borrowed(), &job_id)
            })
            .await
    }

    pub async fn bundle_download(&self, job_id: &str) -> Result<FileDownload, AppError> {
        let deps = self.query.owned();
        let job_id = job_id.to_owned();
        self.query
            .download_generation
            .run(format!("{job_id}:bundle"), move || {
                bundle_download(&deps.borrowed(), &job_id)
            })
            .await
    }
}
