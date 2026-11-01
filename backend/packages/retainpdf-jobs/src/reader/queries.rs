use retainpdf_api_base::error::AppError;
use crate::views::{ReaderMetadataView, ReaderRegionItemView, ReaderRegionsView};

use crate::reader::reader_regions::{
    load_reader_metadata_view, load_reader_region_item, load_reader_regions_view,
};
use retainpdf_api_base::job_loading::load_supported_job;
use crate::query::JobQueries;

impl JobQueries<'_> {
    pub fn reader_regions_view(&self, job_id: &str) -> Result<ReaderRegionsView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_reader_regions_view(self.data_root, &job)
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
