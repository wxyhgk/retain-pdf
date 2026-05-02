use axum::extract::{Multipart, State};
use axum::Json;

use crate::error::AppError;
use crate::models::{ApiResponse, UploadRecord};
use crate::routes::common::{build_upload_route_deps, ok_json, UploadRouteDeps};
use crate::services::upload_api::{store_upload as store_upload_service, store_upload_view};
use crate::AppState;

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
    let deps = build_upload_route_deps(&state);
    Ok(ok_json(
        store_upload_view(
            deps.db,
            deps.uploads_dir,
            deps.upload_max_bytes,
            deps.upload_max_pages,
            deps.python_bin,
            filename,
            bytes,
            developer_mode,
        )
        .await?,
    ))
}

pub async fn store_upload(
    deps: &UploadRouteDeps<'_>,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    store_upload_service(
        deps.db,
        deps.uploads_dir,
        deps.upload_max_bytes,
        deps.upload_max_pages,
        deps.python_bin,
        filename,
        bytes,
        developer_mode,
    )
    .await
}
