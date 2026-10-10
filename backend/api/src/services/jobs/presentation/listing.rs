use std::path::Path;

use super::super::live_stage::{load_live_stage_snapshots, LiveStageSnapshot};
use super::super::query::list_jobs_filtered;
use super::super::stage_view::build_job_stage_view;
use super::super::summary_loaders::SummaryCache;
use super::helpers::{cover_url, derive_display_name, job_path_prefix};
use super::helpers::{page_count_for_job, source_file_name, thumbnail_url, upload_id};
use crate::config::limits::MAX_JOB_LIMIT;
use crate::db::Db;
use crate::job_failure::classify_job_failure;
use crate::error::AppError;
use crate::models::api::{
    summarize_list_invocation, to_absolute_url, DocumentJobListView, JobFailureBriefView,
    JobListItemView, JobListView, ListDocumentJobsQuery, ListJobsQuery,
};
use crate::models::domain::{JobFailureInfo, JobSnapshot, UploadRecord};

pub fn build_job_list_view(
    db: &Db,
    data_root: &Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<JobListView, AppError> {
    let jobs = list_jobs_filtered(db, query)?;
    let items = build_job_list_items(
        db,
        data_root,
        &jobs,
        base_url,
        query.include_live_stage != Some(false),
    );
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
    let items = build_job_list_items(db, data_root, &jobs, base_url, true);
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

fn build_job_list_items(
    db: &Db,
    data_root: &Path,
    jobs: &[JobSnapshot],
    base_url: &str,
    include_live_stage: bool,
) -> Vec<JobListItemView> {
    let ids: Vec<_> = jobs.iter().filter_map(upload_id).collect();
    // Upload metadata was always optional: an unavailable record falls back to
    // job artifacts and the source URL, without retrying per display field.
    let uploads = db.get_uploads(&ids).unwrap_or_default();
    let titles = crate::services::artifacts::document_titles_for(db, uploads.values());
    let live_stages = if include_live_stage {
        load_live_stage_snapshots(db, jobs, data_root)
    } else {
        // First paint needs current persisted status, not a full historical
        // event import. Details and explicit live reads retain their contract.
        Default::default()
    };
    let mut summaries = SummaryCache::default();
    jobs.iter()
        .map(|job| {
            let upload = upload_id(job).and_then(|id| uploads.get(id));
            build_job_list_item_view(
                data_root,
                job,
                base_url,
                upload,
                &titles,
                &mut summaries,
                live_stages.get(&job.job_id),
            )
        })
        .collect()
}

fn build_job_list_item_view(
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
    upload: Option<&UploadRecord>,
    titles: &crate::services::artifacts::DocumentTitles,
    summaries: &mut SummaryCache,
    live_stage: Option<&LiveStageSnapshot>,
) -> JobListItemView {
    let detail_path = format!("{}/{}", job_path_prefix(job), job.job_id);
    let stage = build_job_stage_view(job, live_stage);
    let (output_pdf_ready, markdown_ready, bundle_ready) =
        super::super::job_readiness(job, data_root);
    let cover_url = cover_url(job, data_root, base_url);
    let thumbnail_url = thumbnail_url(job, data_root, base_url);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name: derive_display_name(upload, job, titles),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        completion_note: crate::services::jobs::stage_view::terminal_completion_note(job),
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
        page_count: page_count_for_job(upload, summaries, job, data_root),
        source_file_name: source_file_name(upload, job),
        cover_url,
        thumbnail_url,
        output_pdf_ready,
        markdown_ready,
        bundle_ready,
        invocation: summaries.invocation(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
        detail_path,
        // 失败的结构化信息一直只在 job 详情里。而书籍详情页只吃这个列表，
        // 从不打详情端点 —— 于是 DB 里躺着「MinerU 解析失败 / 上游 / 可重试 /
        // 建议」，用户看到的只有「失败」两个字。
        //
        // 这里给的是精简版（不含 traceback，列表 2 秒轮询一次）。
        failure: build_list_failure_brief(job),
        source_artifact_job_id: Some(job.request_payload.source.artifact_job_id.trim().to_string())
            .filter(|value| !value.is_empty()),
    }
}

/// 列表项里那份失败简报。
///
/// 和详情端点走同一条分类：优先用任务自己存的 `failure`，没有就现场 classify ——
/// 否则同一个任务在列表和详情里会给出两种说法。
fn build_list_failure_brief(job: &JobSnapshot) -> Option<JobFailureBriefView> {
    job.failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields))
        .as_ref()
        .map(JobFailureBriefView::from_failure)
}
