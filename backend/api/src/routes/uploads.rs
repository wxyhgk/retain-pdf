use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::models::domain::UploadRecord;
use crate::routes::common::{
    build_upload_route_deps, ok_json, read_multipart_field_limited, read_multipart_text_limited,
    safe_multipart_error, ApiMultipart, UploadRouteDeps,
};
use crate::services::uploads::api::{store_upload as store_upload_service, store_upload_view};
use crate::AppState;

pub async fn upload_pdf(
    State(state): State<AppState>,
    ApiMultipart(mut multipart): ApiMultipart,
) -> Result<Json<ApiResponse<crate::models::UploadView>>, AppError> {
    const TEXT_FIELD_MAX_BYTES: std::num::NonZeroU64 =
        std::num::NonZeroU64::new(1024 * 1024).expect("multipart text limit is non-zero");

    let deps = build_upload_route_deps(&state);
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;

    while let Some(field) = multipart.next_field().await.map_err(safe_multipart_error)? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            if file_bytes.is_some() {
                return Err(AppError::bad_request("duplicate multipart field: file"));
            }
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = read_multipart_field_limited(field, deps.upload_max_bytes).await?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
        } else if name == "developer_mode" {
            let value = read_multipart_text_limited(field, TEXT_FIELD_MAX_BYTES).await?;
            developer_mode = matches!(value.trim(), "1" | "true" | "True" | "TRUE");
        }
    }

    let filename =
        file_name.ok_or_else(|| AppError::bad_request("missing multipart field: file"))?;
    let bytes = file_bytes.ok_or_else(|| AppError::bad_request("empty upload"))?;
    Ok(ok_json(
        store_upload_view(&deps.uploads, filename, bytes, developer_mode).await?,
    ))
}

pub async fn store_upload(
    deps: &UploadRouteDeps<'_>,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    store_upload_service(&deps.uploads, filename, bytes, developer_mode).await
}
