use std::path::PathBuf;

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    LibraryBatchDeleteInput, LibraryBatchDeleteResultView, LibraryBookDetailView,
    LibraryBookListView, LibraryDeleteResultView, ListJobsQuery,
};
use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::book_projection::{
    build_library_book_detail_view, build_library_book_list_view,
};
use super::LibraryDeps;

pub fn list_library_books(
    deps: &LibraryDeps<'_>,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    build_library_book_list_view(deps.db, deps.data_root, query, base_url)
}

pub fn get_library_book(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    base_url: &str,
) -> Result<LibraryBookDetailView, AppError> {
    let job = load_library_job(deps.db, job_id)?;
    Ok(build_library_book_detail_view(
        deps.db,
        deps.data_root,
        &job,
        base_url,
    ))
}

pub fn delete_library_book(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    force: bool,
) -> Result<LibraryDeleteResultView, AppError> {
    let mut jobs = vec![load_library_job(deps.db, job_id)?];
    if let Ok(child) = deps.db.get_job(&format!("{job_id}-ocr")) {
        jobs.push(child);
    }
    for job in &jobs {
        ensure_deletable(job, force)?;
        // Bảo vệ không gian khối neo:Được trích dẫn bởi mục ưa thích run Tất cả các ngắt neo sau khi xóa,Từ chối xóa
        let referencing = deps
            .db
            .favorites_referencing_job(&job.job_id)
            .unwrap_or(0);
        if referencing > 0 {
            return Err(AppError::conflict(format!(
                "job {} is referenced by {referencing} favorite(s); remove the favorites first",
                job.job_id
            )));
        }
    }

    // xóa job Hãy nhớ giấy tờ trước đây thuộc về,xóaxong reconcile hắn active_job_id,
    // Nếu không, dòng tài liệu sẽ treo lủng lẳng để trỏ đến mục đã xóa job,Frontend join cho đến khi nó biến thành một lá bài zombie.。
    let affected_document = deps
        .db
        .get_document_by_job_id(job_id)
        .ok()
        .flatten()
        .map(|doc| doc.document_id);

    let mut removed_paths = Vec::new();
    let mut removed_child_jobs = Vec::new();
    for job in &jobs {
        removed_paths.extend(remove_job_files(deps, &job.job_id)?);
        deps.db.delete_job(&job.job_id)?;
        if job.job_id != job_id {
            removed_child_jobs.push(job.job_id.clone());
        }
    }

    if let Some(document_id) = affected_document {
        // reconcile Lỗi không chặn xóa(job Đã xóa),Chỉ ghi——Tài liệu bị treo lơ lửng ở mức tồi tệ nhất,
        // Bất kỳ lần tiếp theo nào job Xóa hoặc bắt đầu san lấp sẽ khắc phục lại。
        if let Err(error) = deps.db.reconcile_document_active_job(&document_id) {
            eprintln!(
                "[library] reconcile active_job for {document_id} after deleting {job_id} failed: {error}"
            );
        }
    }

    Ok(LibraryDeleteResultView {
        deleted: true,
        job_id: job_id.to_string(),
        removed_paths,
        removed_child_jobs,
    })
}

pub fn delete_library_books(
    deps: &LibraryDeps<'_>,
    input: &LibraryBatchDeleteInput,
) -> Result<LibraryBatchDeleteResultView, AppError> {
    let mut items = Vec::new();
    for job_id in &input.ids {
        items.push(delete_library_book(deps, job_id, input.force)?);
    }
    Ok(LibraryBatchDeleteResultView { items })
}

fn load_library_job(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = db
        .get_job(job_id)
        .map_err(|_| AppError::not_found(format!("book not found: {job_id}")))?;
    if job.workflow == WorkflowKind::Ocr {
        return Err(AppError::not_found(format!("book not found: {job_id}")));
    }
    Ok(job)
}

pub(super) fn ensure_deletable(job: &JobSnapshot, force: bool) -> Result<(), AppError> {
    if !force && matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "book is {:?}; pass force=true to delete it",
            job.status
        )));
    }
    Ok(())
}

pub(super) fn remove_job_files(deps: &LibraryDeps<'_>, job_id: &str) -> Result<Vec<String>, AppError> {
    let mut removed = Vec::new();
    remove_path_if_exists(deps.output_root.join(job_id), &mut removed)?;
    remove_path_if_exists(
        deps.downloads_dir.join(format!("{job_id}.zip")),
        &mut removed,
    )?;
    Ok(removed)
}

pub(super) fn remove_path_if_exists(path: PathBuf, removed: &mut Vec<String>) -> Result<(), AppError> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_dir() {
        std::fs::remove_dir_all(&path)?;
    } else {
        std::fs::remove_file(&path)?;
    }
    removed.push(path.to_string_lossy().to_string());
    Ok(())
}
