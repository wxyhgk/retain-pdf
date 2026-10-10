mod diagnostics;
mod reader_regions;
#[cfg(test)]
mod tests;
mod translation_debug;

use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    ArtifactLinksView, DocumentJobListView, JobArtifactManifestView, JobDetailView,
    JobEventListView, JobListView, ListDocumentJobsQuery, ListJobEventsQuery, ListJobsQuery,
};
use crate::models::domain::{JobSnapshot, WorkflowKind};
use crate::storage_paths::{
    job_uses_legacy_output_layout, job_uses_legacy_path_storage, LEGACY_JOB_UNSUPPORTED_MESSAGE,
};

use super::presentation::{
    build_document_job_list_view, build_job_artifact_links_view, build_job_artifact_manifest_view,
    build_job_detail_view, build_job_list_view,
};

/// Read-only job views require only persisted state and its artifacts, never a
/// launcher, upload service, or download/replay configuration.
pub struct JobQueries<'a> {
    db: &'a Db,
    data_root: &'a Path,
}

impl<'a> JobQueries<'a> {
    pub fn live_translation_events_after(
        &self,
        job_id: &str,
        after_seq: i64,
        limit: u32,
    ) -> Result<Vec<crate::models::api::LiveTranslationCommitEventView>, AppError> {
        load_supported_job(self.db, self.data_root, job_id)?;
        super::live_translation::load_live_translation_events_after(
            self.db,
            job_id,
            after_seq.max(0),
            limit,
        )
    }
    pub(crate) fn new(db: &'a Db, data_root: &'a Path) -> Self {
        Self { db, data_root }
    }

    pub fn document_jobs_view(
        &self,
        base_url: &str,
        document_id: &str,
        query: &ListDocumentJobsQuery,
    ) -> Result<DocumentJobListView, AppError> {
        self.db
            .get_document(document_id)
            .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
        build_document_job_list_view(self.db, self.data_root, document_id, query, base_url)
    }

    pub fn list_jobs_view(
        &self,
        base_url: &str,
        query: &ListJobsQuery,
    ) -> Result<JobListView, AppError> {
        build_job_list_view(self.db, self.data_root, query, base_url)
    }

    pub fn job_detail_view(
        &self,
        base_url: &str,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobDetailView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        Ok(build_job_detail_view(
            self.db,
            self.data_root,
            &job,
            base_url,
        ))
    }

    pub fn job_artifacts_view(
        &self,
        base_url: &str,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<ArtifactLinksView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        Ok(build_job_artifact_links_view(
            self.data_root,
            &job,
            base_url,
        ))
    }

    pub fn job_artifact_manifest_view(
        &self,
        base_url: &str,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobArtifactManifestView, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        build_job_artifact_manifest_view(self.db, self.data_root, &job, base_url)
    }

    pub fn job_events_view(
        &self,
        job_id: &str,
        query: &ListJobEventsQuery,
        ocr_only: bool,
    ) -> Result<JobEventListView, AppError> {
        super::event_feed::read_events(self.db, self.data_root, job_id, query, ocr_only)
    }

    fn load_supported_job_snapshot(
        &self,
        job_id: &str,
        ocr_only: bool,
    ) -> Result<JobSnapshot, AppError> {
        if ocr_only {
            load_ocr_job_with_supported_layout(self.db, self.data_root, job_id)
        } else {
            load_supported_job(self.db, self.data_root, job_id)
        }
    }
}

pub(super) fn load_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    db.get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))
}

fn ensure_supported_job_layout(data_root: &Path, job: &JobSnapshot) -> Result<(), AppError> {
    if job_uses_legacy_output_layout(job, data_root) || job_uses_legacy_path_storage(job) {
        return Err(AppError::conflict(LEGACY_JOB_UNSUPPORTED_MESSAGE));
    }
    Ok(())
}

pub(super) fn load_supported_job(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    // 合并结果的虚拟 id（`merged-<文档>-<指纹>`）只在读路径上认。写操作走
    // `load_job_or_404`，数据库里查不到它，重试/取消/删除自然被拒绝。
    if crate::services::merge::reading::is_virtual_job_id(job_id) {
        return crate::services::merge::reading::load_virtual_job(db, data_root, job_id);
    }
    let job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub(super) fn load_ocr_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    if !matches!(job.workflow, WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub(super) fn load_ocr_job_with_supported_layout(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub(super) fn list_jobs_filtered(
    db: &Db,
    query: &ListJobsQuery,
) -> Result<Vec<JobSnapshot>, AppError> {
    Ok(db.select_jobs(
        &crate::db::JobListSelection {
            status: query.status.as_ref(),
            workflow: query.workflow.as_ref(),
            provider: query.provider.as_deref(),
            limit: Some(query.limit.clamp(1, crate::config::limits::MAX_JOB_LIMIT)),
            offset: query.offset,
            owner: query.owner.as_deref(),
            ..Default::default()
        },
        |_, _| true,
    )?)
}

#[cfg(test)]
#[path = "query/list_selection_tests.rs"]
mod list_selection_tests;
