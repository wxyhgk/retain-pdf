//! Document CRUD and projection helpers.

use std::path::PathBuf;

use retainpdf_core::config::limits::MAX_DOCUMENT_LIMIT;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::paging::checked_limit;
use retainpdf_core::models::api::{to_absolute_url, DocumentRecord};
use retainpdf_files::document_file_path;
use crate::views::{
    DocumentDeleteResultView, DocumentListView, ListDocumentsQuery, PatchDocumentInput,
};
use retainpdf_core::models::domain::UploadRecord;
use retainpdf_jobs::cleanup_deleted_job_credentials;

use retainpdf_jobs::{ensure_deletable, ensure_no_dependents, find_job, remove_path_if_exists, JobDeletion};
use retainpdf_data::db::Db;
use super::LibraryDeps;

pub(crate) fn document_media_urls(base_url: &str, document_id: &str) -> (String, String, String) {
    let url = |name: &str| to_absolute_url(base_url, &document_file_path(document_id, name));
    (
        // 原文默认下载（以前的 `/source.pdf` 就是这样），所以带 `?download=1`。
        url("source.pdf?download=1"),
        url("cover.jpg"),
        url("thumbnail.jpg"),
    )
}

pub(crate) fn with_document_media_urls(
    mut document: DocumentRecord,
    base_url: &str,
) -> DocumentRecord {
    let (source_pdf_url, cover_url, thumbnail_url) =
        document_media_urls(base_url, &document.document_id);
    document.source_pdf_url = source_pdf_url;
    document.cover_url = cover_url;
    document.thumbnail_url = thumbnail_url;
    document
}

/// Resolve document + its stored upload, ensuring the source PDF exists on disk.
pub(crate) fn require_document_upload(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<(DocumentRecord, UploadRecord), AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let upload = deps
        .db
        .find_upload_for_document(document_id)?
        .ok_or_else(|| {
            AppError::not_found(format!(
                "no upload found for document: {document_id}; re-upload the PDF first"
            ))
        })?;
    let path = PathBuf::from(&upload.stored_path);
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "source pdf missing on disk for document: {document_id}"
        )));
    }
    Ok((document, upload))
}

pub fn list_documents(
    deps: &LibraryDeps<'_>,
    query: &ListDocumentsQuery,
    base_url: &str,
    owner: Option<&str>,
) -> Result<DocumentListView, AppError> {
    // 带 `job_id` 时也先校验 `limit`：越界一律 400，不看走哪条路。
    let limit = checked_limit(query.limit, MAX_DOCUMENT_LIMIT)?;
    if let Some(job_id) = query
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
    {
        // 合并结果的虚拟 id 不在 jobs 表里，但 id 本身就写着它属于哪本书。阅读器拿书名和
        // 原文 PDF、AI 服务核对「这个任务属于哪个文档」走的都是这条路。
        let by_job = match retainpdf_core::storage_paths::MergedJobId::parse(job_id) {
            // 书不在：列表是空的；读不出来是 500。
            Some(merged) => match deps.db.get_document(&merged.document_id) {
                Ok(document) => Some(document),
                Err(error) if AppError::is_record_missing(&error) => None,
                Err(error) => return Err(error.into()),
            },
            None => deps.db.get_document_by_job_id(job_id)?,
        };
        let documents: Vec<_> = by_job
            .into_iter()
            .map(|doc| with_document_media_urls(doc, base_url))
            .collect::<Vec<_>>();
        let total = documents.len() as u64;
        // 按任务查：最多一条，不分页；`limit`、`offset` 照请求回显，`has_more` 恒为 false。
        return Ok(DocumentListView { documents, total, limit, offset: query.offset, has_more: false });
    }
    let filter = retainpdf_data::db::DocumentListFilter {
        reading_status: query.reading_status.as_deref(),
        collection_id: query.collection_id.as_deref(),
        tag_id: query.tag_id.as_deref(),
        query: query.q.as_deref(),
        owner,
    };
    let (documents, total) = deps.db.list_documents_with_total(limit, query.offset, &filter)?;
    let documents = documents
        .into_iter()
        .map(|doc| with_document_media_urls(doc, base_url))
        .collect::<Vec<_>>();
    // 页和 total 读自同一个快照，不会跳过行，直接算。
    let has_more = u64::from(query.offset).saturating_add(documents.len() as u64) < total;
    Ok(DocumentListView { documents, total, limit, offset: query.offset, has_more })
}

pub fn get_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    Ok(with_document_media_urls(document, base_url))
}

/// 强制删除前要先取消的任务编号(名下全部任务 + 各自的 `-ocr` 子任务)（和 `DELETE /jobs/:job_id` 的 `JobDeletion::job_ids` 同一个意思）。
pub fn document_delete_job_ids(db: &Db, document_id: &str) -> Result<Vec<String>, AppError> {
    db.get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let mut job_ids = db.job_ids_for_document(document_id)?;
    for job_id in job_ids.clone() {
        let child = format!("{job_id}-ocr");
        if !job_ids.contains(&child) && find_job(db, &child)?.is_some() {
            job_ids.push(child);
        }
    }
    Ok(job_ids)
}

/// 彻底删除一篇文档:文档行 + 名下所有 job(含 -ocr 子 job)+ upload(s) +
/// 磁盘文件。沿用馆藏删除的收藏保护——被收藏引用则 409(force 不绕过,
/// 与 `DELETE /jobs/:job_id` 一致;force 仅绕过"运行中 job 不可删")。
///
/// "只入库不翻译"进来的文档没有 book job,也能经此彻底删除(是它唯一的
/// 删除入口)。
pub fn delete_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    force: bool,
) -> Result<DocumentDeleteResultView, AppError> {
    // 收集名下所有 job:jobs.document_id 关联的 + 每个的 -ocr 子 job(找不到文档 → 404)
    let job_ids = document_delete_job_ids(deps.db, document_id)?;

    // 逐个校验可删(运行中的 job 需 force)
    let mut jobs = Vec::new();
    for job_id in &job_ids {
        if let Some(job) = find_job(deps.db, job_id)? {
            ensure_deletable(&job, force)?;
            jobs.push(job);
        }
    }

    ensure_no_dependents(deps.db, &jobs, force)?;

    let uploads = deps.db.uploads_for_document(document_id)?;
    // 问答记录随书级联删，记着的 agent 会话编号要在删之前取出来。
    let ask_sessions = deps.db.ask_thread_session_ids(document_id)?;

    // 先一次性提交所有 DB 删除,再动磁盘。
    //
    // 原先是"删一个 job 的文件→删它的行→下一个→……→删 upload 目录→删 upload
    // 行→删文档行",每步各自提交。中途任何一步出错(磁盘 IO 失败、DB 忙、进程
    // 被杀)都会留下半删状态,而这些状态没有任何自动修复路径:文档行还在但名下
    // job 已被删光,书架上就是一本点开即 404 的书;反过来文档没了而 job 成孤儿,
    // 则永远不会再被任何清理逻辑看到。
    //
    // 文件删除进不了事务,所以两类残留只能二选一。选留文件:孤儿文件占的是可
    // 回收的磁盘空间,重删幂等;而丢失的索引行拿不回来。
    let removed_jobs: Vec<String> = jobs.iter().map(|job| job.job_id.clone()).collect();
    let upload_ids: Vec<String> = uploads
        .iter()
        .map(|upload| upload.upload_id.clone())
        .collect();
    let deleted = deps
        .db
        .delete_document_cascade(document_id, &removed_jobs, &upload_ids)?;

    let mut removed_paths = Vec::new();
    // 书的缓存目录（合并阅读、封面、缩略图、页预览）：库里的行删了才删，删不掉只记日志（S51）。
    match retainpdf_files::remove_document_artifacts_dir(deps.data_root, document_id) {
        Ok(Some(path)) => removed_paths.push(path.to_string_lossy().into_owned()),
        Ok(None) => {}
        Err(error) => tracing::warn!(%document_id, %error, "cannot remove the document cache directory"),
    }
    crate::ask_threads::forget_agent_sessions(deps, ask_sessions);
    for job in &jobs {
        removed_paths.extend(job_deletion(deps).remove_job_files(&job.job_id)?);
    }
    cleanup_deleted_job_credentials(deps.db, deps.data_root, &jobs);

    // upload 的磁盘目录(uploads/<upload_id>/...)
    for upload in &uploads {
        let stored = PathBuf::from(&upload.stored_path);
        if let Some(parent) = stored.parent() {
            remove_path_if_exists(parent.to_path_buf(), &mut removed_paths)?;
        } else {
            remove_path_if_exists(stored, &mut removed_paths)?;
        }
    }

    Ok(DocumentDeleteResultView {
        deleted,
        document_id: document_id.to_string(),
        removed_jobs,
        removed_paths,
    })
}

pub fn patch_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    payload: &PatchDocumentInput,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    if payload
        .title
        .as_deref()
        .is_some_and(|title| title.trim().is_empty() || title.chars().count() > 512)
    {
        return Err(AppError::bad_request(
            "title must contain 1 to 512 characters",
        ));
    }
    if let Some(status) = payload.reading_status.as_deref() {
        if !matches!(status, "unread" | "reading" | "done") {
            return Err(AppError::bad_request(
                "reading_status must be one of: unread, reading, done",
            ));
        }
    }
    let document = deps
        .db
        .update_document_fields(
            document_id,
            payload.title.as_deref().map(str::trim),
            payload.reading_status.as_deref(),
        )
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    Ok(with_document_media_urls(document, base_url))
}

/// 书库里删任务目录经任务包的 [`JobDeletion`]（书架删除 2026-10-22 删了以后，只剩整本删除在用）。
fn job_deletion<'a>(deps: &LibraryDeps<'a>) -> JobDeletion<'a> {
    JobDeletion::new(deps.db, deps.data_root, deps.output_root, deps.downloads_dir)
}
