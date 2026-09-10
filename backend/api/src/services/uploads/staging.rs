use super::pdf::load_pdf_page_count;
use super::{UploadError, UploadedPdfInput};
use crate::db::Db;
use crate::models::domain::{build_job_id, now_iso, UploadRecord};
use std::path::{Path, PathBuf};

struct PendingUpload(PathBuf);

impl Drop for PendingUpload {
    fn drop(&mut self) {
        if !self.0.as_os_str().is_empty() {
            if let Err(error) = std::fs::remove_dir_all(&self.0) {
                tracing::warn!(error_kind = ?error.kind(), "failed to remove rejected upload directory");
            }
        }
    }
}

/// Reduces a client-supplied multipart filename to a bare file-name component
/// so it can never be used to escape the per-upload directory (e.g. via
/// `../../etc/x.pdf` or an absolute path like `/etc/x.pdf`).
pub(super) fn sanitize_upload_filename(filename: &str) -> Result<PathBuf, UploadError> {
    if filename.contains('\0') {
        return Err(UploadError::bad_request("uploaded filename is invalid"));
    }
    let candidate = Path::new(filename)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| UploadError::bad_request("uploaded filename is invalid"))?;
    if candidate.is_empty()
        || candidate == "."
        || candidate == ".."
        || candidate.contains('/')
        || candidate.contains('\\')
    {
        return Err(UploadError::bad_request("uploaded filename is invalid"));
    }
    Ok(PathBuf::from(candidate))
}

pub(super) struct PreparedUpload {
    pending: PendingUpload,
    pub(super) path: PathBuf,
    record: UploadRecord,
    pub(super) page_count: Option<u32>,
}

pub(super) fn prepare_upload(
    uploads_dir: &Path,
    upload: UploadedPdfInput,
    safe_filename: PathBuf,
    byte_count: u64,
) -> Result<PreparedUpload, UploadError> {
    let upload_id = build_job_id();
    let upload_dir = uploads_dir.join(&upload_id);
    std::fs::create_dir_all(uploads_dir)?;
    // Own only a newly created directory; a collision must not delete others' data.
    std::fs::create_dir(&upload_dir)?;
    let pending = PendingUpload(upload_dir.clone());
    let upload_path: PathBuf = upload_dir.join(&safe_filename);
    std::fs::write(&upload_path, &upload.bytes)?;

    let page_count = load_pdf_page_count(&upload_path).ok();
    let content_hash = crate::db::documents::sha256_hex(&upload.bytes);
    let record = UploadRecord {
        upload_id,
        filename: upload.filename,
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: byte_count,
        page_count: page_count.unwrap_or(0),
        uploaded_at: now_iso(),
        developer_mode: upload.developer_mode,
        content_hash,
    };
    Ok(PreparedUpload {
        pending,
        path: upload_path,
        record,
        page_count,
    })
}

pub(super) fn publish_upload(
    db: &Db,
    mut prepared: PreparedUpload,
    upload_max_pages: u32,
) -> Result<UploadRecord, UploadError> {
    let page_count = prepared
        .page_count
        .ok_or_else(|| UploadError::internal("PDF validation incomplete"))?;
    if upload_max_pages > 0 && page_count > upload_max_pages {
        return Err(UploadError::bad_request(format!(
            "当前服务限制：PDF 页数必须不超过 {} 页",
            upload_max_pages
        )));
    }
    prepared.record.page_count = page_count;
    db.save_upload_with_document(&prepared.record)
        .map_err(|_| UploadError::internal("Failed to publish uploaded PDF"))?;
    prepared.pending.0 = PathBuf::new();
    Ok(prepared.record)
}
