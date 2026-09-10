use std::num::NonZeroU64;

use axum::extract::Multipart;

use crate::error::AppError;
use crate::models::request::CreateJobInput;
use crate::routes::common::{
    read_multipart_field_limited, read_multipart_text_limited, safe_multipart_error,
};

use super::fields::apply_multipart_request_field;

const MULTIPART_TEXT_FIELD_MAX_BYTES: NonZeroU64 =
    NonZeroU64::new(1024 * 1024).expect("multipart text limit is non-zero");

pub struct ParsedTranslateBundle {
    pub filename: String,
    pub file_bytes: Vec<u8>,
    pub developer_mode: bool,
    pub request: CreateJobInput,
}

pub struct ParsedOcrJob {
    pub filename: Option<String>,
    pub file_bytes: Option<Vec<u8>>,
    pub developer_mode: bool,
    pub request: CreateJobInput,
}

pub async fn parse_translate_bundle_request(
    multipart: &mut Multipart,
    upload_max_bytes: NonZeroU64,
) -> Result<ParsedTranslateBundle, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobInput::default();

    while let Some(field) = multipart.next_field().await.map_err(safe_multipart_error)? {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            if file_bytes.is_some() {
                return Err(AppError::bad_request("duplicate multipart field: file"));
            }
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = read_multipart_field_limited(field, upload_max_bytes).await?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }

        let value = read_multipart_text_limited(field, MULTIPART_TEXT_FIELD_MAX_BYTES).await?;
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedTranslateBundle {
        filename: file_name
            .ok_or_else(|| AppError::bad_request("missing multipart field: file"))?,
        file_bytes: file_bytes.ok_or_else(|| AppError::bad_request("empty upload"))?,
        developer_mode,
        request,
    })
}

pub async fn parse_ocr_job_request(
    multipart: &mut Multipart,
    upload_max_bytes: NonZeroU64,
) -> Result<ParsedOcrJob, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobInput::default();

    while let Some(field) = multipart.next_field().await.map_err(safe_multipart_error)? {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            if file_bytes.is_some() {
                return Err(AppError::bad_request("duplicate multipart field: file"));
            }
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = read_multipart_field_limited(field, upload_max_bytes).await?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }
        let value = read_multipart_text_limited(field, MULTIPART_TEXT_FIELD_MAX_BYTES).await?;
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedOcrJob {
        filename: file_name,
        file_bytes,
        developer_mode,
        request,
    })
}

#[cfg(test)]
mod tests {
    use axum::body::{to_bytes, Body};
    use axum::http::{header, Request, StatusCode};
    use axum::routing::post;
    use axum::Router;
    use serde_json::Value;
    use tower::ServiceExt;

    use crate::routes::common::ApiMultipart;

    use super::*;

    const TEST_LIMIT: NonZeroU64 = NonZeroU64::new(4).expect("test limit is non-zero");
    const BOUNDARY: &str = "retainpdf-pdf-upload-test";

    async fn parse_translate(ApiMultipart(mut multipart): ApiMultipart) -> Result<(), AppError> {
        parse_translate_bundle_request(&mut multipart, TEST_LIMIT)
            .await
            .map(|_| ())
    }

    async fn parse_ocr(ApiMultipart(mut multipart): ApiMultipart) -> Result<(), AppError> {
        parse_ocr_job_request(&mut multipart, TEST_LIMIT)
            .await
            .map(|_| ())
    }

    fn file_field(filename: &str, value: &str) -> String {
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/pdf\r\n\r\n{value}\r\n"
        )
    }

    fn multipart_request(body: String) -> Request<Body> {
        Request::builder()
            .method("POST")
            .uri("/parse")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={BOUNDARY}"),
            )
            .header(header::CONTENT_LENGTH, "1")
            .body(Body::from(body))
            .unwrap()
    }

    async fn error_payload(response: axum::response::Response) -> Value {
        serde_json::from_slice(
            &to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read response body"),
        )
        .expect("parse error response")
    }

    #[tokio::test]
    async fn pdf_parsers_enforce_stream_limit_without_trusting_content_length() {
        let body = format!("{}--{BOUNDARY}--\r\n", file_field("input.pdf", "12345"));

        for router in [
            Router::new().route("/parse", post(parse_translate)),
            Router::new().route("/parse", post(parse_ocr)),
        ] {
            let response = router
                .oneshot(multipart_request(body.clone()))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
            let payload = error_payload(response).await;
            assert_eq!(payload["code"], 41300);
            assert_eq!(payload["message"], "request body is too large");
            assert_eq!(payload["error"]["code"], "PAYLOAD_TOO_LARGE");
        }
    }

    #[tokio::test]
    async fn pdf_parsers_reject_duplicate_file_before_reading_second_body() {
        let body = format!(
            "{}{}--{BOUNDARY}--\r\n",
            file_field("first.pdf", "1234"),
            file_field("second.pdf", "12345")
        );

        for router in [
            Router::new().route("/parse", post(parse_translate)),
            Router::new().route("/parse", post(parse_ocr)),
        ] {
            let response = router
                .oneshot(multipart_request(body.clone()))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            let payload = error_payload(response).await;
            assert_eq!(payload["code"], 40000);
            assert_eq!(payload["message"], "duplicate multipart field: file");
            assert_eq!(payload["error"]["code"], "BAD_REQUEST");
        }
    }
}
