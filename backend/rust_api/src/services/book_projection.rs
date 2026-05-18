use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::{
    to_absolute_url, ArtifactDisplayItemView, ArtifactLinksView, BookSummaryView, JobProgressView,
    JobSnapshot, LibraryBookDetailView, LibraryBookListItemView, LibraryBookListView,
    ListJobsQuery, WorkflowKind,
};
use crate::storage_paths::{resolve_markdown_path, resolve_output_pdf, resolve_source_pdf};

use crate::models::build_artifact_links;
use crate::services::jobs::presentation::live_stage::load_live_stage_snapshot;
use crate::services::jobs::presentation::summary_loaders::load_normalization_summary;
use crate::services::jobs::readiness;

pub(crate) fn build_library_book_list_view(
    db: &Db,
    data_root: &Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    let mut query = query.clone();
    query.workflow = None;
    let items = list_books_filtered(db, &query)?
        .iter()
        .filter(|job| job.workflow != WorkflowKind::Ocr)
        .map(|job| build_library_book_list_item(db, data_root, job, base_url))
        .collect();
    Ok(LibraryBookListView { items })
}

pub(crate) fn build_library_book_detail_view(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> LibraryBookDetailView {
    let display_name = derive_display_name(db, job);
    let summary = build_book_summary(db, job, data_root, base_url, &display_name)
        .with_cover_url(library_image_url(job, data_root, base_url, "cover"));
    let progress = live_progress(job, data_root);
    let (pdf_ready, markdown_ready, bundle_ready) =
        readiness(job, data_root, resolve_output_pdf, resolve_markdown_path);
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
        stage: live_stage(job, data_root),
        progress,
        cover_url: summary.cover_url,
        thumbnail_url: library_image_url(job, data_root, base_url, "thumbnail"),
        artifacts: build_artifacts_display(&artifacts),
    }
}

pub(crate) fn build_artifacts_display(
    artifacts: &ArtifactLinksView,
) -> Vec<ArtifactDisplayItemView> {
    vec![
        artifact_display_item(
            "output_pdf",
            "译文 PDF",
            "pdf",
            artifacts.pdf.ready,
            artifacts.pdf.file_name.clone(),
            artifacts.pdf.size_bytes,
            Some(artifacts.pdf.url.clone()),
        ),
        artifact_display_item(
            "markdown",
            "Markdown",
            "markdown",
            artifacts.markdown.ready,
            artifacts.markdown.file_name.clone(),
            artifacts.markdown.size_bytes,
            Some(artifacts.markdown.raw_url.clone()),
        ),
        artifact_display_item(
            "bundle",
            "任务打包文件",
            "zip",
            artifacts.bundle.ready,
            artifacts.bundle.file_name.clone(),
            artifacts.bundle.size_bytes,
            Some(artifacts.bundle.url.clone()),
        ),
        artifact_display_item(
            "normalized_document",
            "标准化 OCR 文档",
            "json",
            artifacts.normalized_document.ready,
            artifacts.normalized_document.file_name.clone(),
            artifacts.normalized_document.size_bytes,
            Some(artifacts.normalized_document.url.clone()),
        ),
        artifact_display_item(
            "normalization_report",
            "OCR 标准化报告",
            "json",
            artifacts.normalization_report.ready,
            artifacts.normalization_report.file_name.clone(),
            artifacts.normalization_report.size_bytes,
            Some(artifacts.normalization_report.url.clone()),
        ),
    ]
}

fn build_library_book_list_item(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> LibraryBookListItemView {
    let display_name = derive_display_name(db, job);
    let progress = live_progress(job, data_root);
    let (output_pdf_ready, markdown_ready, bundle_ready) =
        readiness(job, data_root, resolve_output_pdf, resolve_markdown_path);
    LibraryBookListItemView {
        id: job.job_id.clone(),
        job_id: job.job_id.clone(),
        title: display_name.clone(),
        display_name,
        source_file_name: source_file_name(db, job),
        authors: None,
        page_count: page_count_for_library(db, job, data_root),
        status: job.status.clone(),
        stage: live_stage(job, data_root),
        stage_detail: live_stage_detail(job, data_root),
        progress,
        cover_url: library_image_url(job, data_root, base_url, "cover"),
        thumbnail_url: library_image_url(job, data_root, base_url, "thumbnail"),
        output_pdf_ready,
        markdown_ready,
        bundle_ready,
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
    }
}

fn artifact_display_item(
    key: &str,
    label: &str,
    kind: &str,
    ready: bool,
    file_name: Option<String>,
    size_bytes: Option<u64>,
    download_url: Option<String>,
) -> ArtifactDisplayItemView {
    ArtifactDisplayItemView {
        key: key.to_string(),
        label: label.to_string(),
        ready,
        kind: kind.to_string(),
        file_name,
        size_bytes,
        download_url: download_url.filter(|_| ready),
    }
}

fn live_progress(job: &JobSnapshot, data_root: &Path) -> JobProgressView {
    let live_stage = load_live_stage_snapshot(job, data_root);
    let current = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.progress_current)
        .or(job.progress_current);
    let total = live_stage
        .as_ref()
        .and_then(|snapshot| snapshot.progress_total)
        .or(job.progress_total);
    JobProgressView {
        current,
        total,
        percent: match (current, total) {
            (Some(current), Some(total)) if total > 0 => {
                Some((current as f64 / total as f64) * 100.0)
            }
            _ => None,
        },
    }
}

fn live_stage(job: &JobSnapshot, data_root: &Path) -> Option<String> {
    load_live_stage_snapshot(job, data_root)
        .and_then(|snapshot| snapshot.stage)
        .or_else(|| job.stage.clone())
}

fn live_stage_detail(job: &JobSnapshot, data_root: &Path) -> Option<String> {
    load_live_stage_snapshot(job, data_root)
        .and_then(|snapshot| snapshot.stage_detail)
        .or_else(|| job.stage_detail.clone())
}

fn page_count_for_library(db: &Db, job: &JobSnapshot, data_root: &Path) -> Option<i64> {
    page_count_for_job(db, job, data_root).or_else(|| {
        load_normalization_summary(job, data_root).and_then(|summary| summary.page_count)
    })
}

fn library_image_url(
    job: &JobSnapshot,
    data_root: &Path,
    base_url: &str,
    kind: &str,
) -> Option<String> {
    resolve_source_pdf(job, data_root).map(|_| {
        to_absolute_url(
            base_url,
            &format!("/api/v1/library/books/{}/{kind}", job.job_id),
        )
    })
}

fn list_books_filtered(db: &Db, query: &ListJobsQuery) -> Result<Vec<JobSnapshot>, AppError> {
    let jobs = db.list_jobs(
        query.limit,
        query.offset,
        query.status.as_ref(),
        query.workflow.as_ref(),
    )?;
    Ok(jobs
        .into_iter()
        .filter(|job| {
            query
                .provider
                .as_deref()
                .map(|provider| {
                    job.artifacts
                        .as_ref()
                        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                        .map(|diag| {
                            format!("{:?}", diag.provider).to_ascii_lowercase()
                                == provider.to_ascii_lowercase()
                        })
                        .unwrap_or(false)
                })
                .unwrap_or(true)
        })
        .collect())
}

fn derive_display_name(db: &Db, job: &JobSnapshot) -> String {
    source_file_name(db, job).unwrap_or_else(|| job.job_id.clone())
}

fn source_file_name(db: &Db, job: &JobSnapshot) -> Option<String> {
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

fn build_book_summary(
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
        file_size_bytes: upload_size,
    }
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

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    #[test]
    fn library_projection_uses_library_media_urls() {
        let data_root = PathBuf::from("/tmp/retainpdf-data");
        let mut job = JobSnapshot::new(
            "job-library-projection".to_string(),
            CreateJobInput::default(),
            Vec::new(),
        );
        job.artifacts = Some(JobArtifacts {
            source_pdf: Some("jobs/job-library-projection/source/input.pdf".to_string()),
            ..JobArtifacts::default()
        });

        let url = library_image_url(&job, &data_root, "https://api.example", "cover");

        assert_eq!(
            url.as_deref(),
            Some("https://api.example/api/v1/library/books/job-library-projection/cover")
        );
    }
}
