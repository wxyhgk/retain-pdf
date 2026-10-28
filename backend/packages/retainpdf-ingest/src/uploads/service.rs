use std::path::PathBuf;
use std::sync::Arc;

use super::capacity::{busy, UploadCapacity};
use super::incoming::{remove_stale_incoming, IncomingFile, IncomingUpload};
use super::pdf::{load_pdf_page_count, repair_pdf_with_pymupdf};
use super::staging::{prepare_upload, publish_upload, sanitize_upload_filename, UploadContent};
use super::UploadError;
use retainpdf_data::db::Db;
use retainpdf_core::models::domain::UploadRecord;
use retainpdf_core::config::{effective_upload_max_bytes, UploadProcessingConfig};

#[derive(Debug)]
pub struct UploadedPdfInput {
    pub filename: String,
    pub bytes: Vec<u8>,
    pub developer_mode: bool,
}

pub struct UploadServiceConfig {
    pub uploads_dir: PathBuf,
    pub python_bin: String,
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
    /// 上传目录所在磁盘至少留多少空间（字节）；0 是不查。
    pub min_free_disk_bytes: u64,
    pub processing: UploadProcessingConfig,
}

struct UploadServiceInner {
    db: Arc<Db>,
    config: UploadServiceConfig,
    capacity: Arc<UploadCapacity>,
}

/// An application-owned upload executor. Clones share the same resource limits.
#[derive(Clone)]
pub struct UploadService {
    inner: Arc<UploadServiceInner>,
}

impl UploadService {
    pub fn new(db: Arc<Db>, config: UploadServiceConfig) -> Self {
        remove_stale_incoming(&config.uploads_dir);
        let capacity = Arc::new(UploadCapacity::new(config.processing.clone()));
        Self {
            inner: Arc::new(UploadServiceInner {
                db,
                config,
                capacity,
            }),
        }
    }

    #[cfg(test)]
    pub(super) fn capacity(&self) -> Arc<UploadCapacity> {
        self.inner.capacity.clone()
    }

    /// 上传目录所在磁盘的剩余空间够不够再放 `incoming` 字节（加上配置的下限）。处理函数在读请求体之前用
    /// `incoming = 0` 先查一次，免得把几百 MB 收完才说放不下。
    pub fn ensure_free_space(&self, incoming: u64) -> Result<(), UploadError> {
        let config = &self.inner.config;
        if config.min_free_disk_bytes == 0 {
            return Ok(());
        }
        retainpdf_api_base::disk_space::ensure_free_space(
            &config.uploads_dir,
            config.min_free_disk_bytes.saturating_add(incoming),
            "store this upload",
        )
        .map_err(|error| UploadError::InsufficientStorage(error.to_string()))
    }

    pub async fn store(
        &self,
        upload: UploadedPdfInput,
    ) -> Result<UploadRecord, UploadError> {
        self.store_for(upload, retainpdf_accounts::Principal::local()).await
    }

    /// 开始收一个上传：先查文件名和磁盘，再开临时文件（见 `incoming.rs`）。不是 PDF 的名字不用等收完再拒。
    /// 收的时候最多收 `max_bytes`（处理函数那边的上限）和服务自己的上限里小的那个。
    pub async fn begin_incoming(
        &self,
        filename: &str,
        max_bytes: u64,
    ) -> Result<IncomingUpload, UploadError> {
        validate_upload_filename(filename)?;
        self.ensure_free_space(0)?;
        let service = self.clone();
        IncomingUpload::create(
            &self.inner.config.uploads_dir,
            max_bytes.min(effective_upload_max_bytes(self.inner.config.upload_max_bytes).get()),
            Box::new(move || service.ensure_free_space(0)),
        )
        .await
    }

    /// 收完的上传落库，记在 `owner` 名下。临时文件换名进 `uploads/<编号>/`，不再读进内存。
    pub async fn store_incoming_for(
        &self,
        filename: String,
        file: IncomingFile,
        developer_mode: bool,
        owner: retainpdf_accounts::Principal,
    ) -> Result<UploadRecord, UploadError> {
        self.store_content_for(filename, developer_mode, UploadContent::Incoming(file), owner)
            .await
    }

    /// 记在 `owner` 名下。多用户模式下书的编号（上传指纹）按账号区分，见 `Principal::scoped_content_hash`。
    pub async fn store_for(
        &self,
        upload: UploadedPdfInput,
        owner: retainpdf_accounts::Principal,
    ) -> Result<UploadRecord, UploadError> {
        self.store_content_for(
            upload.filename,
            upload.developer_mode,
            UploadContent::Bytes(upload.bytes),
            owner,
        )
        .await
    }

    async fn store_content_for(
        &self,
        filename: String,
        developer_mode: bool,
        content: UploadContent,
        owner: retainpdf_accounts::Principal,
    ) -> Result<UploadRecord, UploadError> {
        let uploads_dir = &self.inner.config.uploads_dir;
        let python_bin = &self.inner.config.python_bin;
        let upload_max_bytes = self.inner.config.upload_max_bytes;
        let upload_max_pages = self.inner.config.upload_max_pages;
        let safe_filename = validate_upload_filename(&filename)?;
        let byte_count = content.byte_count();
        if byte_count > effective_upload_max_bytes(upload_max_bytes).get() {
            return Err(UploadError::payload_too_large("request body is too large"));
        }
        // 原文要落两份（原样一份、修复或规范化后一份），按两倍文件大小加上下限算；
        // 边收边写的那一份已经在盘上了，只算还要写的那一份。
        let incoming = match content {
            UploadContent::Bytes(_) => byte_count.saturating_mul(2),
            UploadContent::Incoming(_) => byte_count,
        };
        self.ensure_free_space(incoming)?;
        let capacity = self.inner.capacity.clone();
        let admitted = capacity
            .admitted
            .clone()
            .try_acquire_owned()
            .map_err(|_| busy())?;
        // 数页数时整份 PDF 读进内存（流读到就扔，见 `pdf::load_page_tree`），峰值约是文件大小，按它占内存预算。
        let buffer = capacity.reserve_buffer(byte_count)?;
        let permit = capacity.acquire(&capacity.parse).await?;
        let db = self.inner.db.clone();
        let uploads_dir = uploads_dir.to_path_buf();
        let python_bin = python_bin.to_string();
        // The admitted worker owns the permit and directory even if the HTTP
        // caller disconnects. Never release capacity while a parser is still alive.
        tokio::spawn(async move {
            let _admitted = admitted;
            let prepared = tokio::task::spawn_blocking(move || {
                let _permit = permit;
                let _buffer = buffer;
                prepare_upload(&uploads_dir, filename, developer_mode, content, safe_filename)
            })
            .await
            .map_err(|_| UploadError::internal("PDF upload worker failed"))??;
            let prepared = if prepared.page_count.is_none() {
                // No parsing permit or original Vec is held while waiting for repair.
                let repair = match capacity.acquire(&capacity.repair).await {
                    Ok(permit) => permit,
                    Err(error) => {
                        let _ = tokio::task::spawn_blocking(move || drop(prepared)).await;
                        return Err(error);
                    }
                };
                tokio::task::spawn_blocking(move || {
                    let _repair = repair;
                    let mut prepared = prepared;
                    repair_pdf_with_pymupdf(&prepared.path, &python_bin)?;
                    prepared.page_count = Some(
                        load_pdf_page_count(&prepared.path)
                            .map_err(|_| UploadError::bad_request("invalid pdf after repair"))?,
                    );
                    Ok::<_, UploadError>(prepared)
                })
                .await
                .map_err(|_| UploadError::internal("PDF repair worker failed"))??
            } else {
                prepared
            };
            tokio::task::spawn_blocking(move || publish_upload(&db, prepared, upload_max_pages, &owner))
                .await
                .map_err(|_| UploadError::internal("PDF publication worker failed"))?
        })
        .await
        .map_err(|_| UploadError::internal("PDF upload worker failed"))?
    }
}

fn validate_upload_filename(filename: &str) -> Result<PathBuf, UploadError> {
    if !filename.to_lowercase().ends_with(".pdf") {
        return Err(UploadError::bad_request("uploaded file must be a PDF"));
    }
    sanitize_upload_filename(filename)
}
