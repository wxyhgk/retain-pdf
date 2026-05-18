use std::path::Path;

use super::super::query::list_jobs_filtered;
use super::helpers::{cover_url, derive_display_name, job_path_prefix};
use super::helpers::{page_count_for_job, source_file_name, thumbnail_url};
use super::live_stage::{list_combined_job_events, load_live_stage_snapshot};
use super::security::redact_job_events;
use super::summary_loaders::load_invocation_summary;
use crate::db::Db;
use crate::error::AppError;
use crate::models::{
    summarize_list_invocation, JobEventListView, JobListItemView, JobListView, JobProgressView,
    JobSnapshot, ListJobEventsQuery, ListJobsQuery,
};
use crate::storage_paths::{resolve_markdown_path, resolve_output_pdf};

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

pub fn build_job_events_view(
    db: &Db,
    data_root: &Path,
    job_id: &str,
    query: &ListJobEventsQuery,
) -> Result<JobEventListView, AppError> {
    let limit = query.limit.clamp(1, 500);
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
    let live_stage = load_live_stage_snapshot(job, data_root);
    let stage = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.stage.clone())
        .or_else(|| job.stage.clone());
    let stage_detail = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.stage_detail.clone())
        .or_else(|| job.stage_detail.clone());
    let progress_current = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.progress_current)
        .or(job.progress_current);
    let progress_total = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.progress_total)
        .or(job.progress_total);
    let percent = match (progress_current, progress_total) {
        (Some(current), Some(total)) if total > 0 => Some((current as f64 / total as f64) * 100.0),
        _ => None,
    };
    let (output_pdf_ready, markdown_ready, bundle_ready) =
        super::super::readiness(job, data_root, resolve_output_pdf, resolve_markdown_path);
    let cover_url = cover_url(job, data_root, base_url);
    let thumbnail_url = thumbnail_url(job, data_root, base_url);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name: derive_display_name(db, job),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        stage,
        stage_detail,
        progress: JobProgressView {
            current: progress_current,
            total: progress_total,
            percent,
        },
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
        detail_url: crate::models::to_absolute_url(base_url, &detail_path),
        detail_path,
    }
}
