use axum::extract::{Multipart, State};
use axum::Json;

use crate::config::AppConfig;
use crate::db::Db;
use crate::error::AppError;
use crate::models::{upload_to_response, ApiResponse, UploadRecord};
use crate::services::jobs::{store_pdf_upload, UploadedPdfInput};
use crate::AppState;

async fn store_upload_with_resources(
    db: &Db,
    config: &AppConfig,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    store_pdf_upload(
        db,
        &config.uploads_dir,
        config.upload_max_bytes,
        config.upload_max_pages,
        UploadedPdfInput {
            filename,
            bytes,
            developer_mode,
        },
    )
    .await
}

pub async fn upload_pdf(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<crate::models::UploadView>>, AppError> {
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
    let upload =
        store_upload_with_resources(state.db.as_ref(), state.config.as_ref(), filename, bytes, developer_mode)
            .await?;
    Ok(Json(ApiResponse::ok(upload_to_response(&upload))))
}

pub async fn store_upload(
    state: &AppState,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    store_upload_with_resources(
        state.db.as_ref(),
        state.config.as_ref(),
        filename,
        bytes,
        developer_mode,
    )
    .await
}
