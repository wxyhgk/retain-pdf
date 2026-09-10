use crate::error::AppError;
use crate::models::api::{ReaderMetadataView, ReaderRegionsView};

use super::super::super::query::load_supported_job;
use super::super::super::reader_regions::{load_reader_metadata_view, load_reader_regions_view};
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn reader_regions_view(&self, job_id: &str) -> Result<ReaderRegionsView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_reader_regions_view(self.query.data_root, &job)
    }

    pub fn reader_metadata_view(&self, job_id: &str) -> Result<ReaderMetadataView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_reader_metadata_view(self.query.data_root, &job)
    }
}
