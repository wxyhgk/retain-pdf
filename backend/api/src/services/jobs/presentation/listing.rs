use std::path::Path;

use super::super::live_stage::{list_combined_job_events, load_live_stage_snapshot};
use super::super::query::list_jobs_filtered;
use super::super::stage_view::build_job_stage_view;
use super::super::summary_loaders::load_invocation_summary;
use super::helpers::{cover_url, derive_display_name, job_path_prefix};
use super::helpers::{page_count_for_job, source_file_name, thumbnail_url};
use super::security::redact_job_events;
use crate::config::limits::MAX_JOB_LIMIT;
use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    summarize_list_invocation, to_absolute_url, DocumentJobListView, JobEventListView,
    JobListItemView, JobListView, ListDocumentJobsQuery, ListJobEventsQuery, ListJobsQuery,
};
use crate::models::domain::JobSnapshot;

pub fn build_job_list_view(
    db: &Db,
    data_root: &Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<JobListView, AppError> {
    let jobs = list_jobs_filtered(db, query)?;
    let items: Vec<_> = jobs
        .iter()
        .map(|job| build_job_list_item_view(db, data_root, job, base_url))
        .collect();
    let invocation_summary = summarize_list_invocation(&items);
    Ok(JobListView {
        items,
        invocation_summary,
    })
}

/// Build the task history for one document. The document relation is resolved by
/// the database; callers never need to infer it from active_job_id.
pub fn build_document_job_list_view(
    db: &Db,
    data_root: &Path,
    document_id: &str,
    query: &ListDocumentJobsQuery,
    base_url: &str,
) -> Result<DocumentJobListView, AppError> {
    let limit = query.limit.clamp(1, MAX_JOB_LIMIT);
    let total = db.count_jobs_for_document(document_id)?;
    let jobs = db.list_jobs_for_document(document_id, limit, query.offset)?;
    let items: Vec<_> = jobs
        .iter()
        .map(|job| build_job_list_item_view(db, data_root, job, base_url))
        .collect();
    let invocation_summary = summarize_list_invocation(&items);
    let returned = items.len() as u64;
    Ok(DocumentJobListView {
        items,
        invocation_summary,
        total,
        limit,
        offset: query.offset,
        has_more: u64::from(query.offset).saturating_add(returned) < total,
    })
}

pub fn build_job_events_view(
    db: &Db,
    data_root: &Path,
    job_id: &str,
    query: &ListJobEventsQuery,
) -> Result<JobEventListView, AppError> {
    let limit = query.limit.clamp(1, MAX_JOB_LIMIT);
    let job = db.get_job(job_id)?;
    let items = redact_job_events(
        &job,
        data_root,
        list_combined_job_events(db, data_root, &job)?
            .into_iter()
            .skip(query.offset as usize)
            .take(limit as usize)
            .collect(),
    );
    Ok(JobEventListView {
        items,
        limit,
        offset: query.offset,
    })
}

fn build_job_list_item_view(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> JobListItemView {
    let detail_path = format!("{}/{}", job_path_prefix(job), job.job_id);
    let live_stage = load_live_stage_snapshot(db, job, data_root);
    let stage = build_job_stage_view(job, live_stage.as_ref());
    let (output_pdf_ready, markdown_ready, bundle_ready) =
        super::super::job_readiness(job, data_root);
    let cover_url = cover_url(job, data_root, base_url);
    let thumbnail_url = thumbnail_url(job, data_root, base_url);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name: derive_display_name(db, job),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        attempt: job
            .runtime
            .as_ref()
            .map(|runtime| runtime.retry_count.saturating_add(1))
            .unwrap_or(1),
        retry_count: job
            .runtime
            .as_ref()
            .map(|runtime| runtime.retry_count)
            .unwrap_or(0),
        last_retry_at: job
            .runtime
            .as_ref()
            .and_then(|runtime| runtime.last_retry_at.clone()),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        stage_snapshot: stage.stage_snapshot,
        background_snapshots: stage.background_snapshots,
        stages: stage.stages,
        page_count: page_count_for_job(db, job, data_root),
        source_file_name: source_file_name(db, job),
        cover_url,
        thumbnail_url,
        output_pdf_ready,
        markdown_ready,
        bundle_ready,
        invocation: load_invocation_summary(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
        detail_path,
    }
}
