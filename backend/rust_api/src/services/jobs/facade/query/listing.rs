use axum::http::HeaderMap;

use crate::error::AppError;
use crate::models::{
    ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView, JobListView,
    JobSnapshot, ListJobEventsQuery, ListJobsQuery,
};

use super::super::super::presentation::{
    build_job_artifact_links_view, build_job_artifact_manifest_view, build_job_detail_view,
    build_job_events_view, build_job_list_view, load_ocr_job_with_supported_layout,
    load_supported_job,
};
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn list_jobs_view(
        &self,
        headers: &HeaderMap,
        query: &ListJobsQuery,
    ) -> Result<JobListView, AppError> {
        let base_url = self.base_url(headers);
        build_job_list_view(
            self.query.db,
            &self.query.config.data_root,
            query,
            &base_url,
        )
    }

    pub fn job_detail_view(
        &self,
        headers: &HeaderMap,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobDetailView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        Ok(build_job_detail_view(
            &self.query.config.data_root,
            &job,
            &self.base_url(headers),
        ))
    }

    pub fn job_artifacts_view(
        &self,
        headers: &HeaderMap,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<ArtifactLinksView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        Ok(build_job_artifact_links_view(
            &self.query.config.data_root,
            &job,
            &self.base_url(headers),
        ))
    }

    pub fn job_artifact_manifest_view(
        &self,
        headers: &HeaderMap,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobArtifactManifestView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        build_job_artifact_manifest_view(
            self.query.db,
            &self.query.config.data_root,
            &job,
            &self.base_url(headers),
        )
    }

    pub fn job_events_view(
        &self,
        job_id: &str,
        query: &ListJobEventsQuery,
        ocr_only: bool,
    ) -> Result<JobEventListView, AppError> {
        self.ensure_job_query_scope(job_id, ocr_only)?;
        build_job_events_view(self.query.db, &self.query.config.data_root, job_id, query)
    }

    pub fn ensure_job_query_scope(&self, job_id: &str, ocr_only: bool) -> Result<(), AppError> {
        let _ = self.load_supported_job_snapshot(job_id, ocr_only)?;
        Ok(())
    }

    pub fn load_supported_job_snapshot(
        &self,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobSnapshot, AppError> {
        if ocr_only {
            load_ocr_job_with_supported_layout(self.query.db, &self.query.config.data_root, job_id)
        } else {
            load_supported_job(self.query.db, &self.query.config.data_root, job_id)
        }
    }
}
