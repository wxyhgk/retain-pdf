use super::incoming::IncomingFile;
use super::pdf::load_pdf_page_count;
use super::UploadError;
use retainpdf_data::db::Db;
use retainpdf_core::models::domain::{build_job_id, now_iso, UploadRecord};
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

/// 上传的内容：边收边写好的临时文件（HTTP 上传），或者内存里的字节（测试和内部调用）。
pub(super) enum UploadContent {
    Bytes(Vec<u8>),
    Incoming(IncomingFile),
}

impl UploadContent {
    pub(super) fn byte_count(&self) -> u64 {
        match self {
            Self::Bytes(bytes) => bytes.len() as u64,
            Self::Incoming(file) => file.byte_count,
        }
    }
}

pub(super) struct PreparedUpload {
    pending: PendingUpload,
    pub(super) path: PathBuf,
    record: UploadRecord,
    pub(super) page_count: Option<u32>,
}

pub(super) fn prepare_upload(
    uploads_dir: &Path,
    filename: String,
    developer_mode: bool,
    content: UploadContent,
    safe_filename: PathBuf,
) -> Result<PreparedUpload, UploadError> {
    let byte_count = content.byte_count();
    let upload_id = build_job_id();
    let upload_dir = uploads_dir.join(&upload_id);
    std::fs::create_dir_all(uploads_dir)?;
    // Own only a newly created directory; a collision must not delete others' data.
    std::fs::create_dir(&upload_dir)?;
    let pending = PendingUpload(upload_dir.clone());
    let upload_path: PathBuf = upload_dir.join(&safe_filename);
    let content_hash = match content {
        UploadContent::Bytes(bytes) => {
            std::fs::write(&upload_path, &bytes)?;
            retainpdf_data::db::documents::sha256_hex(&bytes)
        }
        UploadContent::Incoming(incoming) => {
            std::fs::rename(incoming.file.path(), &upload_path)?;
            incoming.file.disarm();
            incoming.sha256_hex
        }
    };

    let page_count = load_pdf_page_count(&upload_path).ok();
    let record = UploadRecord {
        upload_id,
        filename,
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: byte_count,
        page_count: page_count.unwrap_or(0),
        uploaded_at: now_iso(),
        developer_mode,
        content_hash,
    };
    Ok(PreparedUpload {
        pending,
        path: upload_path,
        record,
        page_count,
    })
}

/// 同样内容的 PDF 已经存过（同一本书又传了一次），把刚收的这一份换成指向已有那份的硬链接：上传记录照旧各有各的
/// 目录，删哪一个都不影响另一个（删掉的只是自己这个名字），盘上只占一份。建不了硬链接（跨盘、文件系统不支持）
/// 或者出了别的错，就留着刚收的这一份，上传照常成功。
///
/// 编号是同一个所有者范围里原样字节的 sha256（多用户时各账号分开算），所以只会和自己传过的那份共用。已有的那份可能
/// 修复过（PyMuPDF 重写，字节和原样不同）：原样字节一样，修复出来的是同一份文档，用哪份都行。上传目录里的文件
/// 只会整份换名替换（修复就是这样），不会原地改写，所以共用一份是安全的。
fn share_existing_copy(db: &Db, path: &Path, content_hash: &str) -> bool {
    let Ok(Some(existing)) = db.upload_with_content_hash(content_hash) else {
        return false;
    };
    let existing = PathBuf::from(existing.stored_path);
    if existing == path || !existing.is_file() {
        return false;
    }
    let Some(name) = path.file_name() else {
        return false;
    };
    let mut staged_name = std::ffi::OsString::from(".");
    staged_name.push(name);
    staged_name.push(".link");
    let staged = path.with_file_name(staged_name);
    let _ = std::fs::remove_file(&staged);
    if std::fs::hard_link(&existing, &staged).is_err() {
        return false;
    }
    if std::fs::rename(&staged, path).is_err() {
        let _ = std::fs::remove_file(&staged);
        return false;
    }
    true
}

pub(super) fn publish_upload(
    db: &Db,
    mut prepared: PreparedUpload,
    upload_max_pages: u32,
    owner: &retainpdf_accounts::Principal,
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
    prepared.record.content_hash = owner.scoped_content_hash(&prepared.record.content_hash);
    share_existing_copy(db, &prepared.path, &prepared.record.content_hash);
    db.save_upload_with_document_for(&prepared.record, owner.owner_id())
        .map_err(|_| UploadError::internal("Failed to publish uploaded PDF"))?;
    prepared.pending.0 = PathBuf::new();
    Ok(prepared.record)
}
