use std::path::Path;

use crate::config::limits::MAX_JOB_LIMIT;
use crate::db::{Db, JobListSelection};
use crate::error::AppError;
use crate::models::api::{
    build_artifact_links, to_absolute_url, LibraryBookDetailView, LibraryBookListItemView,
    LibraryBookListView, ListJobsQuery,
};
use crate::models::domain::{JobSnapshot, UploadRecord};
use crate::storage_paths::resolve_source_pdf;

use crate::services::artifacts::build_artifacts_display;
use crate::services::jobs::job_readiness;
use crate::services::jobs::live_stage::{load_live_stage_snapshots, LiveStageSnapshot};
use crate::services::jobs::summary_loaders::SummaryCache;

mod live;
mod metadata;

use live::{build_live_projection, project_live_stage};
use metadata::{
    build_book_summary, derive_display_name, page_count_for_library, source_file_name,
    source_url_file_name, upload_id,
};
use crate::services::artifacts::{document_titles_for, DocumentTitles};

pub(crate) fn build_library_book_list_view(
    db: &Db,
    data_root: &Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    let jobs = list_books_filtered(db, query)?;
    let ids: Vec<_> = jobs.iter().filter_map(upload_id).collect();
    let uploads = db.get_uploads(&ids).unwrap_or_default();
    let titles = document_titles_for(db, uploads.values());
    let live_stages = if query.include_live_stage != Some(false) {
        load_live_stage_snapshots(db, &jobs, data_root)
    } else {
        Default::default()
    };
    let mut summaries = SummaryCache::default();
    let items = jobs
        .iter()
        .map(|job| {
            let upload = upload_id(job).and_then(|id| uploads.get(id));
            build_library_book_list_item(
                data_root,
                job,
                base_url,
                upload,
                &titles,
                &mut summaries,
                live_stages.get(&job.job_id),
            )
        })
        .collect();
    Ok(LibraryBookListView { items })
}

pub(crate) fn build_library_book_detail_view(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> LibraryBookDetailView {
    let ids: Vec<_> = upload_id(job).into_iter().collect();
    let uploads = db.get_uploads(&ids).unwrap_or_default();
    let upload = upload_id(job).and_then(|id| uploads.get(id));
    let mut summaries = SummaryCache::default();
    let titles = document_titles_for(db, upload);
    let display_name = derive_display_name(upload, job, &titles);
    let summary = build_book_summary(upload, &mut summaries, job, data_root, &display_name)
        .with_cover_url(library_image_url(job, upload, data_root, base_url, "cover"))
        .with_thumbnail_url(library_image_url(job, upload, data_root, base_url, "thumbnail"));
    let live = build_live_projection(db, job, data_root);
    let (pdf_ready, markdown_ready, bundle_ready) = job_readiness(job, data_root);
    let artifacts = build_artifact_links(
        job,
        base_url,
        data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    );
    LibraryBookDetailView {
        id: job.job_id.clone(),
        job_id: job.job_id.clone(),
        title: summary.title,
        authors: summary.authors,
        source_file_name: summary.source_file_name,
        page_count: summary.page_count,
        source_language: summary.source_language,
        target_language: summary.target_language,
        file_size_bytes: summary.file_size_bytes,
        status: job.status.clone(),
        stage: live.stage,
        progress: live.progress,
        cover_url: summary.cover_url,
        thumbnail_url: summary.thumbnail_url,
        artifacts: build_artifacts_display(&artifacts),
    }
}

fn build_library_book_list_item(
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
    upload: Option<&UploadRecord>,
    titles: &DocumentTitles,
    summaries: &mut SummaryCache,
    live_stage: Option<&LiveStageSnapshot>,
) -> LibraryBookListItemView {
    let display_name = derive_display_name(upload, job, titles);
    let live = project_live_stage(job, live_stage);
    let (output_pdf_ready, markdown_ready, bundle_ready) = job_readiness(job, data_root);
    LibraryBookListItemView {
        id: job.job_id.clone(),
        job_id: job.job_id.clone(),
        title: display_name.clone(),
        display_name,
        source_file_name: source_file_name(upload, job),
        authors: None,
        page_count: page_count_for_library(upload, summaries, job, data_root),
        status: job.status.clone(),
        stage: live.stage,
        stage_detail: live.stage_detail,
        progress: live.progress,
        cover_url: library_image_url(job, upload, data_root, base_url, "cover"),
        thumbnail_url: library_image_url(job, upload, data_root, base_url, "thumbnail"),
        output_pdf_ready,
        markdown_ready,
        bundle_ready,
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
    }
}

/// 封面、缩略图从源 PDF 生成，是书（document）的属性：有书的编号就给 `/documents/:id/…`，
/// 同一本书的几个任务、书架和文档列表共用一个地址，浏览器只缓存一份。旧上传记录没回填
/// 编号时退回按任务的地址。
fn library_image_url(
    job: &JobSnapshot,
    upload: Option<&UploadRecord>,
    data_root: &Path,
    base_url: &str,
    kind: &str,
) -> Option<String> {
    let document_id = upload.map(|upload| upload.content_hash.trim()).filter(|id| !id.is_empty());
    resolve_source_pdf(job, data_root).map(|_| {
        let path = match document_id {
            Some(document_id) => format!("/api/v1/documents/{document_id}/{kind}"),
            None => format!("/api/v1/library/books/{}/{kind}", job.job_id),
        };
        to_absolute_url(base_url, &path)
    })
}

fn list_books_filtered(db: &Db, query: &ListJobsQuery) -> Result<Vec<JobSnapshot>, AppError> {
    let search_query = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    // 分类文件夹展开时用 job_ids 精确点名一批 job(见 ListJobsQuery 字段注释)——
    // 和 q 一样需要先在全量里过滤,不能先按 limit/offset 截断再匹配。
    let job_ids: Option<Vec<String>> = query
        .job_ids
        .as_deref()
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|ids| !ids.is_empty());
    let search_query = search_query.map(|value| value.to_ascii_lowercase());
    // Exact IDs request the complete matching set, as before. Ordinary pages
    // apply their offset only after OCR exclusion, decoded validity and search.
    Ok(db.select_jobs(
        &JobListSelection {
            status: query.status.as_ref(),
            provider: query.provider.as_deref(),
            exclude_ocr: true,
            job_ids: job_ids.as_deref(),
            include_upload_filename: search_query.is_some(),
            limit: job_ids
                .is_none()
                .then_some(query.limit.clamp(1, MAX_JOB_LIMIT)),
            offset: if job_ids.is_some() { 0 } else { query.offset },
            ..Default::default()
        },
        |job, upload_filename| {
            search_query
                .as_deref()
                .map(|q| library_search_text(job, upload_filename).contains(q))
                .unwrap_or(true)
        },
    )?)
}

fn library_search_text(job: &JobSnapshot, upload_filename: Option<&str>) -> String {
    let source_filename = upload_filename
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .or_else(|| source_url_file_name(&job.request_payload.source.source_url));
    [
        job.job_id.as_str(),
        job.stage.as_deref().unwrap_or(""),
        job.stage_detail.as_deref().unwrap_or(""),
        job.error.as_deref().unwrap_or(""),
        job.request_payload.source.source_url.as_str(),
        source_filename.as_deref().unwrap_or(""),
    ]
    .join(" ")
    .to_ascii_lowercase()
}

#[cfg(test)]
#[path = "book_projection/tests.rs"]
mod tests;
