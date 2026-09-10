use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    build_artifact_links, to_absolute_url, LibraryBookDetailView, LibraryBookListItemView,
    LibraryBookListView, ListJobsQuery,
};
use crate::models::domain::{JobSnapshot, WorkflowKind};
use crate::storage_paths::resolve_source_pdf;

use crate::services::jobs::job_readiness;

mod artifacts;
mod live;
mod metadata;

pub(crate) use artifacts::build_artifacts_display;
use live::build_live_projection;
use metadata::{build_book_summary, derive_display_name, page_count_for_library, source_file_name};

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
        .with_cover_url(library_image_url(job, data_root, base_url, "cover"))
        .with_thumbnail_url(library_image_url(job, data_root, base_url, "thumbnail"));
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
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> LibraryBookListItemView {
    let display_name = derive_display_name(db, job);
    let live = build_live_projection(db, job, data_root);
    let (output_pdf_ready, markdown_ready, bundle_ready) = job_readiness(job, data_root);
    LibraryBookListItemView {
        id: job.job_id.clone(),
        job_id: job.job_id.clone(),
        title: display_name.clone(),
        display_name,
        source_file_name: source_file_name(db, job),
        authors: None,
        page_count: page_count_for_library(db, job, data_root),
        status: job.status.clone(),
        stage: live.stage,
        stage_detail: live.stage_detail,
        progress: live.progress,
        cover_url: library_image_url(job, data_root, base_url, "cover"),
        thumbnail_url: library_image_url(job, data_root, base_url, "thumbnail"),
        output_pdf_ready,
        markdown_ready,
        bundle_ready,
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
    }
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
    let search_query = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    // 分类文件夹展开时用 job_ids 精确点名一批 job(见 ListJobsQuery 字段注释)——
    // 和 q 一样需要先在全量里过滤,不能先按 limit/offset 截断再匹配。
    let job_ids: Option<std::collections::HashSet<String>> = query
        .job_ids
        .as_deref()
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
                .collect::<std::collections::HashSet<_>>()
        })
        .filter(|ids| !ids.is_empty());
    let wide_fetch = search_query.is_some() || job_ids.is_some();
    let (fetch_limit, fetch_offset) = if wide_fetch {
        (10_000, 0)
    } else {
        (query.limit, query.offset)
    };
    let jobs = db.list_jobs(
        fetch_limit,
        fetch_offset,
        query.status.as_ref(),
        query.workflow.as_ref(),
    )?;
    let search_query = search_query.map(|value| value.to_ascii_lowercase());
    let filtered: Vec<JobSnapshot> = jobs
        .into_iter()
        .filter(|job| {
            search_query
                .as_deref()
                .map(|q| library_search_text(db, job).contains(q))
                .unwrap_or(true)
        })
        .filter(|job| {
            job_ids
                .as_ref()
                .map(|ids| ids.contains(&job.job_id))
                .unwrap_or(true)
        })
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
        .collect();
    if job_ids.is_some() {
        // 精确集合查询:调用方要的是"这些 job 的完整数据",不是一页列表,
        // 不做 limit/offset 截断。
        return Ok(filtered);
    }
    Ok(filtered
        .into_iter()
        .skip(if search_query.is_some() {
            query.offset as usize
        } else {
            0
        })
        .take(query.limit as usize)
        .collect())
}

fn library_search_text(db: &Db, job: &JobSnapshot) -> String {
    [
        job.job_id.as_str(),
        job.stage.as_deref().unwrap_or(""),
        job.stage_detail.as_deref().unwrap_or(""),
        job.error.as_deref().unwrap_or(""),
        job.request_payload.source.source_url.as_str(),
        source_file_name(db, job).as_deref().unwrap_or(""),
    ]
    .join(" ")
    .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::models::domain::{JobArtifacts, JobSnapshot};
    use crate::models::request::CreateJobInput;

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
