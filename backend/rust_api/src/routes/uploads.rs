use std::path::PathBuf;

use axum::extract::{Multipart, State};
use axum::Json;
use lopdf::Document;
use tokio::io::AsyncWriteExt;

use crate::error::AppError;
use crate::models::{build_job_id, now_iso, upload_to_response, ApiResponse, UploadRecord};
use crate::AppState;

pub async fn upload_pdf(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<crate::models::UploadResponseData>>, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
        } else if name == "developer_mode" {
            let value = field.text().await.unwrap_or_default();
            developer_mode = matches!(value.trim(), "1" | "true" | "True" | "TRUE");
        }
    }

    let filename =
        file_name.ok_or_else(|| AppError::bad_request("missing multipart field: file"))?;
    let bytes = file_bytes.ok_or_else(|| AppError::bad_request("empty upload"))?;
    let upload = store_upload(&state, filename, bytes, developer_mode).await?;
    state.db.save_upload(&upload)?;
    Ok(Json(ApiResponse::ok(upload_to_response(&upload))))
}

pub async fn store_upload(
    state: &AppState,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    if !filename.to_lowercase().ends_with(".pdf") {
        return Err(AppError::bad_request("uploaded file must be a PDF"));
    }
    let byte_count = bytes.len() as u64;
    let upload_id = build_job_id();
    let upload_dir = state.config.uploads_dir.join(&upload_id);
    tokio::fs::create_dir_all(&upload_dir).await?;
    let upload_path: PathBuf = upload_dir.join(&filename);
    let mut f = tokio::fs::File::create(&upload_path).await?;
    f.write_all(&bytes).await?;
    f.flush().await?;

    let page_count = Document::load(&upload_path)
        .map(|doc| doc.get_pages().len() as u32)
        .map_err(|e| AppError::bad_request(format!("invalid pdf: {e}")))?;

    if !developer_mode {
        if byte_count > state.config.normal_max_bytes {
            return Err(AppError::bad_request("普通用户仅支持 10MB 以内 PDF"));
        }
        if page_count > state.config.normal_max_pages {
            return Err(AppError::bad_request("普通用户仅支持 30 页以内 PDF"));
        }
    }

    Ok(UploadRecord {
        upload_id: upload_id.clone(),
        filename,
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: byte_count,
        page_count,
        uploaded_at: now_iso(),
        developer_mode,
    })
}
