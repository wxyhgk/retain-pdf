use retainpdf_api_base::error::AppError;
use crate::views::{ReaderLayoutView, ReaderMetadataView, ReaderRegionsView};

use crate::reader::reader_regions::{
    load_reader_metadata_view, load_reader_regions_view,
    load_reader_regions_view_for, reader_regions_fingerprint,
};
use retainpdf_api_base::job_loading::load_supported_job;
use retainpdf_core::storage_paths::MergedJobId;
use retainpdf_files::job_upload_id;
use crate::query::JobQueries;

impl JobQueries<'_> {
    pub fn reader_regions_view(&self, job_id: &str) -> Result<ReaderRegionsView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_reader_regions_view(self.data_root, &job)
    }

    /// 带 ETag 的区块数据：浏览器带来的 ETag（If-None-Match 里的指纹）和现在的一样就不返回数据（`None`，
    /// 路由回 304），否则返回现在的指纹和数据。
    pub fn reader_regions_view_if_changed(
        &self,
        job_id: &str,
        known_fingerprints: &[String],
    ) -> Result<(String, Option<ReaderRegionsView>), AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        let fingerprint = reader_regions_fingerprint(self.data_root, &job);
        if known_fingerprints.iter().any(|known| known == &fingerprint) {
            return Ok((fingerprint, None));
        }
        let view = load_reader_regions_view_for(self.data_root, &job, &fingerprint)?;
        Ok((fingerprint, Some(view)))
    }

    pub fn reader_metadata_view(&self, job_id: &str) -> Result<ReaderMetadataView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_reader_metadata_view(self.data_root, &job)
    }

    /// rpr_fit 排的版面清单（2026-11-28）；没有时 `available: false`，不是 404。
    pub fn reader_layout_view(&self, base_url: &str, job_id: &str) -> Result<ReaderLayoutView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        Ok(crate::reader::layout::load_reader_layout_view(self.data_root, &job, base_url))
    }

    /// 版面的底图 PDF；没有是 404。
    pub fn reader_layout_background(&self, job_id: &str) -> Result<retainpdf_files::FileDownload, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        crate::reader::layout::reader_layout_background(self.data_root, &job)
    }

    /// 一页版面：`(etag, 这页)`。浏览器带来的 ETag 一样就不读文件（`None`，路由回 304）。
    pub fn reader_layout_page_if_changed(
        &self,
        job_id: &str,
        index: u32,
        known_etags: &[String],
    ) -> Result<(String, Option<serde_json::Value>), AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        if let Some(etag) = crate::reader::layout::reader_layout_page_etag(self.data_root, &job, index) {
            if known_etags.iter().any(|known| known == &etag) {
                return Ok((etag, None));
            }
        }
        let (etag, page) = crate::reader::layout::load_reader_layout_page(self.data_root, &job, index)?;
        Ok((etag, Some(page)))
    }

    /// 阅读页提问的自带 agent 读哪本书（2026-11-25）：任务在不在（合并阅读的虚拟任务 `merged-…` 也认，和阅读页同一个
    /// 加载函数，没有就 404），以及它的书编号（原文页图用）；查不到书的任务是 None。
    pub fn ask_book_document_id(&self, job_id: &str) -> Result<Option<String>, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        if let Some(merged) = MergedJobId::parse(job_id) {
            return Ok(Some(merged.document_id));
        }
        let upload = job_upload_id(&job).and_then(|id| self.db.get_upload(id).ok());
        Ok(crate::presentation::book_document_id(self.db, &job, upload.as_ref()))
    }
}
