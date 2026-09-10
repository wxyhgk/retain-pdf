use std::num::NonZeroU64;

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{
    build_fonts_route_deps, read_multipart_field_limited, safe_multipart_error, ApiMultipart,
};
use crate::services::fonts::api::{self, FontInfo};
use crate::AppState;

pub async fn list_fonts(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<FontInfo>>>, AppError> {
    let deps = build_fonts_route_deps(&state);
    Ok(Json(ApiResponse::ok(api::list_fonts(&deps.font_api))))
}

pub async fn upload_font(
    State(state): State<AppState>,
    ApiMultipart(multipart): ApiMultipart,
) -> Result<Json<ApiResponse<FontInfo>>, AppError> {
    let deps = build_fonts_route_deps(&state);
    let (filename, bytes) =
        read_font_upload(ApiMultipart(multipart), deps.upload_max_bytes).await?;
    let info = api::upload_font(&deps.font_api, &filename, &bytes)?;
    Ok(Json(ApiResponse::ok(info)))
}

async fn read_font_upload(
    ApiMultipart(mut multipart): ApiMultipart,
    max_bytes: NonZeroU64,
) -> Result<(String, Vec<u8>), AppError> {
    while let Some(field) = multipart.next_field().await.map_err(safe_multipart_error)? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" || name == "font" {
            let filename = field
                .file_name()
                .map(str::to_string)
                .unwrap_or_else(|| "upload.otf".to_string());
            let bytes = read_multipart_field_limited(field, max_bytes).await?;
            return Ok((filename, bytes.to_vec()));
        }
    }

    Err(AppError::bad_request("missing multipart field: file"))
}

#[cfg(test)]
mod tests {
    use axum::body::{to_bytes, Body};
    use axum::http::{header, Request, StatusCode};
    use axum::routing::post;
    use axum::Router;
    use serde_json::Value;
    use tower::ServiceExt;

    use super::*;

    async fn read_font_with_four_byte_limit(multipart: ApiMultipart) -> Result<(), AppError> {
        read_font_upload(multipart, NonZeroU64::new(4).unwrap())
            .await
            .map(|_| ())
    }

    fn multipart_request(body: String) -> Request<Body> {
        Request::builder()
            .method("POST")
            .uri("/font")
            .header(
                header::CONTENT_TYPE,
                "multipart/form-data; boundary=font-upload-test",
            )
            .header(header::CONTENT_LENGTH, "1")
            .body(Body::from(body))
            .unwrap()
    }

    fn file_field(filename: &str, value: &str) -> String {
        format!(
            "--font-upload-test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: font/otf\r\n\r\n{value}\r\n"
        )
    }

    #[tokio::test]
    async fn font_field_enforces_stream_limit_without_trusting_content_length() {
        let body = format!(
            "{}--font-upload-test--\r\n",
            file_field("test.otf", "12345")
        );
        let response = Router::new()
            .route("/font", post(read_font_with_four_byte_limit))
            .oneshot(multipart_request(body))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
        let payload: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(payload["code"], 41300);
        assert_eq!(payload["error"]["code"], "PAYLOAD_TOO_LARGE");
    }

    #[tokio::test]
    async fn font_upload_stops_after_first_candidate_file() {
        let body = format!(
            "{}{}--font-upload-test--\r\n",
            file_field("first.otf", "1234"),
            file_field("second.otf", "12345")
        );
        let response = Router::new()
            .route("/font", post(read_font_with_four_byte_limit))
            .oneshot(multipart_request(body))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
