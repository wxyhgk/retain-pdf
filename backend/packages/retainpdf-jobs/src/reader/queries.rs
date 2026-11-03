use retainpdf_api_base::error::AppError;
use crate::views::{ReaderMetadataView, ReaderRegionItemView, ReaderRegionsView};

use crate::reader::reader_regions::{
    load_reader_metadata_view, load_reader_region_item, load_reader_regions_view,
    load_reader_regions_view_for, reader_regions_fingerprint,
};
use retainpdf_api_base::job_loading::load_supported_job;
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

    pub fn reader_region_item_view(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<ReaderRegionItemView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_reader_region_item(self.data_root, &job, item_id)
    }

    pub fn reader_metadata_view(&self, job_id: &str) -> Result<ReaderMetadataView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_reader_metadata_view(self.data_root, &job)
    }
}
