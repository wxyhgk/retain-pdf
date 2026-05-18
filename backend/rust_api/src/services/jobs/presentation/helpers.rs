use std::path::Path;

use crate::db::Db;
use crate::models::{
    to_absolute_url, BookSummaryView, JobFailureDiagnosticView, JobSnapshot, OcrJobSummaryView,
};
use crate::storage_paths::resolve_source_pdf;

pub(super) fn derive_display_name(db: &Db, job: &JobSnapshot) -> String {
    if let Some(source_file_name) = source_file_name(db, job) {
        return source_file_name;
    }

    job.job_id.clone()
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

    if let Some(name) = source_url_file_name(&job.request_payload.source.source_url) {
        return Some(name);
    }

    None
}

pub(super) fn upload_book_stats(db: &Db, job: &JobSnapshot) -> (Option<i64>, Option<u64>) {
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

pub(super) fn page_count_for_job(db: &Db, job: &JobSnapshot, data_root: &Path) -> Option<i64> {
    upload_book_stats(db, job)
        .0
        .or_else(|| {
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.pages_processed)
        })
        .or_else(|| {
            super::summary_loaders::load_normalization_summary(job, data_root)
                .and_then(|summary| summary.page_count.or(summary.pages_seen))
        })
}

pub(super) fn build_book_summary(
    db: &Db,
    job: &JobSnapshot,
    data_root: &Path,
    base_url: &str,
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
        cover_url: cover_url(job, data_root, base_url),
        file_size_bytes: upload_size,
    }
}

pub(super) fn cover_url(job: &JobSnapshot, data_root: &Path, base_url: &str) -> Option<String> {
    resolve_source_pdf(job, data_root).map(|_| job_image_url(job, base_url, "cover"))
}

pub(super) fn thumbnail_url(job: &JobSnapshot, data_root: &Path, base_url: &str) -> Option<String> {
    resolve_source_pdf(job, data_root).map(|_| job_image_url(job, base_url, "thumbnail"))
}

fn job_image_url(job: &JobSnapshot, base_url: &str, kind: &str) -> String {
    to_absolute_url(
        base_url,
        &format!("{}/{}/{}", job.workflow.job_api_prefix(), job.job_id, kind),
    )
}

pub(super) fn source_url_file_name(source_url: &str) -> Option<String> {
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

pub(super) fn job_path_prefix(job: &JobSnapshot) -> &'static str {
    job.workflow.job_api_prefix()
}

pub(super) fn build_ocr_job_summary(
    job: &JobSnapshot,
    base_url: &str,
) -> Option<OcrJobSummaryView> {
    let artifacts = job.artifacts.as_ref()?;
    let ocr_job_id = artifacts.ocr_job_id.as_ref()?;
    let detail_path = format!("/api/v1/ocr/jobs/{ocr_job_id}");
    Some(OcrJobSummaryView {
        job_id: ocr_job_id.clone(),
        status: artifacts.ocr_status.clone(),
        trace_id: artifacts.ocr_trace_id.clone(),
        provider_trace_id: artifacts.ocr_provider_trace_id.clone(),
        detail_path: detail_path.clone(),
        detail_url: crate::models::to_absolute_url(base_url, &detail_path),
    })
}

pub(super) fn job_failure_to_legacy_view(
    failure: &crate::models::JobFailureInfo,
) -> JobFailureDiagnosticView {
    let failure = failure.clone().with_formal_fields();
    JobFailureDiagnosticView {
        failed_stage: failure.failed_stage_value().to_string(),
        error_kind: failure.failure_code_value().to_string(),
        summary: failure.summary.clone(),
        root_cause: failure.root_cause.clone(),
        retryable: failure.retryable,
        upstream_host: failure.upstream_host.clone(),
        suggestion: failure.suggestion.clone(),
        last_log_line: failure.last_log_line.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::source_url_file_name;

    #[test]
    fn source_url_file_name_extracts_tail() {
        assert_eq!(
            source_url_file_name("https://example.com/files/paper.pdf?download=1#top"),
            Some("paper.pdf".to_string())
        );
    }

    #[test]
    fn source_url_file_name_rejects_empty_tail() {
        assert_eq!(source_url_file_name("https://example.com/files/"), None);
    }
}
