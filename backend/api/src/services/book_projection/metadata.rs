use std::path::Path;

use crate::db::Db;
use crate::models::api::BookSummaryView;
use crate::models::domain::JobSnapshot;
use crate::services::jobs::summary_loaders::load_normalization_summary;

pub(super) fn derive_display_name(db: &Db, job: &JobSnapshot) -> String {
    source_file_name(db, job).unwrap_or_else(|| job.job_id.clone())
}

pub(super) fn source_file_name(db: &Db, job: &JobSnapshot) -> Option<String> {
    if let Some(upload_id) = job
        .upload_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Ok(upload) = db.get_upload(upload_id) {
            let file_name = upload.filename.trim();
            if !file_name.is_empty() {
                return Some(file_name.to_string());
            }
        }
    }
    source_url_file_name(&job.request_payload.source.source_url)
}

pub(super) fn page_count_for_library(db: &Db, job: &JobSnapshot, data_root: &Path) -> Option<i64> {
    page_count_for_job(db, job, data_root).or_else(|| {
        load_normalization_summary(job, data_root).and_then(|summary| summary.page_count)
    })
}

pub(super) fn build_book_summary(
    db: &Db,
    job: &JobSnapshot,
    data_root: &Path,
    _base_url: &str,
    display_name: &str,
) -> BookSummaryView {
    let (upload_page_count, upload_size) = upload_book_stats(db, job);
    BookSummaryView {
        title: display_name.to_string(),
        authors: None,
        page_count: upload_page_count.or_else(|| page_count_for_job(db, job, data_root)),
        source_language: Some(job.request_payload.ocr.language.clone())
            .filter(|value| !value.trim().is_empty()),
        target_language: None,
        source_file_name: source_file_name(db, job),
        cover_url: None,
        thumbnail_url: None,
        file_size_bytes: upload_size,
    }
}

fn upload_book_stats(db: &Db, job: &JobSnapshot) -> (Option<i64>, Option<u64>) {
    let Some(upload_id) = job
        .upload_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return (None, None);
    };
    match db.get_upload(upload_id) {
        Ok(upload) => (Some(upload.page_count as i64), Some(upload.bytes)),
        Err(_) => (None, None),
    }
}

fn page_count_for_job(db: &Db, job: &JobSnapshot, data_root: &Path) -> Option<i64> {
    upload_book_stats(db, job)
        .0
        .or_else(|| {
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.pages_processed)
        })
        .or_else(|| {
            load_normalization_summary(job, data_root)
                .and_then(|summary| summary.page_count.or(summary.pages_seen))
        })
}

fn source_url_file_name(source_url: &str) -> Option<String> {
    let trimmed = source_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let no_fragment = trimmed.split('#').next().unwrap_or(trimmed);
    let no_query = no_fragment.split('?').next().unwrap_or(no_fragment);
    let candidate = no_query.rsplit('/').next().unwrap_or(no_query).trim();
    if candidate.is_empty() {
        return None;
    }
    Some(candidate.to_string())
}
