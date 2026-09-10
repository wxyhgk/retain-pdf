use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};
use thiserror::Error;

#[derive(Clone, Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    PayloadTooLarge(String),
    #[error("{0}")]
    UnsupportedMediaType(String),
    #[error("{0}")]
    UnprocessableEntity(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    MethodNotAllowed(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    TooManyRequests(String),
    #[error("{0}")]
    BadGateway(String),
    #[error("{0}")]
    ServiceUnavailable(String),
    #[error("{0}")]
    Internal(String),
    #[error("{message}")]
    OcrArtifactReuse {
        status: StatusCode,
        code: &'static str,
        message: String,
        reason: &'static str,
        can_fallback_to_ocr: bool,
    },
    #[error("{message}")]
    CredentialReference {
        status: StatusCode,
        code: &'static str,
        message: String,
    },
    #[error("{message}")]
    LiveTranslation {
        status: StatusCode,
        code: &'static str,
        message: String,
    },
    #[error("{message}")]
    DocumentMetadata {
        status: StatusCode,
        code: &'static str,
        message: String,
    },
}

#[derive(Serialize)]
struct ErrorBody {
    code: i32,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct OcrArtifactReuseErrorBody {
    code: &'static str,
    message: String,
    reason: &'static str,
    can_fallback_to_ocr: bool,
    error: StructuredError,
}

#[derive(Serialize)]
struct CredentialReferenceErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct LiveTranslationErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct DocumentMetadataErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct StructuredError {
    code: &'static str,
    http_status: u16,
    details: Value,
}

impl StructuredError {
    fn empty(code: &'static str, status: StatusCode) -> Self {
        Self {
            code,
            http_status: status.as_u16(),
            details: json!({}),
        }
    }

    fn ocr_artifact_reuse(
        code: &'static str,
        status: StatusCode,
        reason: &'static str,
        can_fallback_to_ocr: bool,
    ) -> Self {
        Self {
            code,
            http_status: status.as_u16(),
            details: json!({
                "reason": reason,
                "can_fallback_to_ocr": can_fallback_to_ocr,
            }),
        }
    }
}

impl AppError {
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(msg.into())
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn payload_too_large(msg: impl Into<String>) -> Self {
        Self::PayloadTooLarge(msg.into())
    }

    pub fn unsupported_media_type(msg: impl Into<String>) -> Self {
        Self::UnsupportedMediaType(msg.into())
    }

    pub fn unprocessable_entity(msg: impl Into<String>) -> Self {
        Self::UnprocessableEntity(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn method_not_allowed(msg: impl Into<String>) -> Self {
        Self::MethodNotAllowed(msg.into())
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    pub fn too_many_requests(msg: impl Into<String>) -> Self {
        Self::TooManyRequests(msg.into())
    }

    pub fn bad_gateway(msg: impl Into<String>) -> Self {
        Self::BadGateway(msg.into())
    }

    pub fn service_unavailable(msg: impl Into<String>) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    pub fn ocr_artifact_reuse(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
        reason: &'static str,
    ) -> Self {
        Self::OcrArtifactReuse {
            status,
            code,
            message: message.into(),
            reason,
            can_fallback_to_ocr: true,
        }
    }

    pub fn credential_reference(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::CredentialReference {
            status,
            code,
            message: message.into(),
        }
    }

    pub fn live_translation(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::LiveTranslation {
            status,
            code,
            message: message.into(),
        }
    }

    pub fn document_metadata(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::DocumentMetadata {
            status,
            code,
            message: message.into(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        if let AppError::OcrArtifactReuse {
            status,
            code,
            message,
            reason,
            can_fallback_to_ocr,
        } = &self
        {
            return (
                *status,
                Json(OcrArtifactReuseErrorBody {
                    code,
                    message: message.clone(),
                    reason,
                    can_fallback_to_ocr: *can_fallback_to_ocr,
                    error: StructuredError::ocr_artifact_reuse(
                        code,
                        *status,
                        reason,
                        *can_fallback_to_ocr,
                    ),
                }),
            )
                .into_response();
        }
        if let AppError::CredentialReference {
            status,
            code,
            message,
        } = &self
        {
            return (
                *status,
                Json(CredentialReferenceErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::empty(code, *status),
                }),
            )
                .into_response();
        }
        if let AppError::LiveTranslation {
            status,
            code,
            message,
        } = &self
        {
            return (
                *status,
                Json(LiveTranslationErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::empty(code, *status),
                }),
            )
                .into_response();
        }
        if let AppError::DocumentMetadata {
            status,
            code,
            message,
        } = &self
        {
            return (
                *status,
                Json(DocumentMetadataErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::empty(code, *status),
                }),
            )
                .into_response();
        }
        let (status, code, stable_code) = match &self {
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, 40100, "UNAUTHORIZED"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, 40300, "FORBIDDEN"),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, 40000, "BAD_REQUEST"),
            AppError::PayloadTooLarge(_) => {
                (StatusCode::PAYLOAD_TOO_LARGE, 41300, "PAYLOAD_TOO_LARGE")
            }
            AppError::UnsupportedMediaType(_) => (
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                41500,
                "UNSUPPORTED_MEDIA_TYPE",
            ),
            AppError::UnprocessableEntity(_) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                42200,
                "UNPROCESSABLE_ENTITY",
            ),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, 40400, "NOT_FOUND"),
            AppError::MethodNotAllowed(_) => {
                (StatusCode::METHOD_NOT_ALLOWED, 40500, "METHOD_NOT_ALLOWED")
            }
            AppError::Conflict(_) => (StatusCode::CONFLICT, 40900, "CONFLICT"),
            AppError::TooManyRequests(_) => {
                (StatusCode::TOO_MANY_REQUESTS, 42900, "TOO_MANY_REQUESTS")
            }
            AppError::BadGateway(_) => (StatusCode::BAD_GATEWAY, 50200, "BAD_GATEWAY"),
            AppError::ServiceUnavailable(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                50300,
                "SERVICE_UNAVAILABLE",
            ),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, 50000, "INTERNAL"),
            AppError::OcrArtifactReuse { .. } => unreachable!("handled above"),
            AppError::CredentialReference { .. } => unreachable!("handled above"),
            AppError::LiveTranslation { .. } => unreachable!("handled above"),
            AppError::DocumentMetadata { .. } => unreachable!("handled above"),
        };
        let body = ErrorBody {
            code,
            message: self.to_string(),
            error: StructuredError::empty(stable_code, status),
        };
        (status, Json(body)).into_response()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

// Uploads owns domain failures; this application boundary owns the HTTP contract.
impl From<crate::services::uploads::UploadError> for AppError {
    fn from(value: crate::services::uploads::UploadError) -> Self {
        use crate::services::uploads::UploadError;
        match value {
            UploadError::BadRequest(message) => Self::bad_request(message),
            UploadError::PayloadTooLarge(message) => Self::payload_too_large(message),
            UploadError::Busy => {
                Self::service_unavailable("PDF processing capacity is busy; please retry")
            }
            UploadError::QueueTimeout => {
                Self::service_unavailable("PDF processing queue wait timed out")
            }
            UploadError::RepairUnavailable => {
                Self::service_unavailable("PDF repair tool unavailable")
            }
            UploadError::RepairTimeout => Self::service_unavailable("PDF repair timed out"),
            UploadError::Internal(message) => Self::internal(message),
            UploadError::Io(error) => Self::from(error),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(value: zip::result::ZipError) -> Self {
        Self::Internal(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;
    use serde_json::Value;

    use super::*;

    async fn response_json(error: AppError) -> (StatusCode, Value) {
        let response = error.into_response();
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read error response body");
        let payload = serde_json::from_slice(&body).expect("parse error response JSON");
        (status, payload)
    }

    #[tokio::test]
    async fn generic_errors_keep_legacy_fields_and_add_stable_error_object() {
        let cases = [
            (
                AppError::unauthorized("unauthorized"),
                StatusCode::UNAUTHORIZED,
                40100,
                "UNAUTHORIZED",
            ),
            (
                AppError::forbidden("forbidden"),
                StatusCode::FORBIDDEN,
                40300,
                "FORBIDDEN",
            ),
            (
                AppError::bad_request("bad request"),
                StatusCode::BAD_REQUEST,
                40000,
                "BAD_REQUEST",
            ),
            (
                AppError::payload_too_large("payload too large"),
                StatusCode::PAYLOAD_TOO_LARGE,
                41300,
                "PAYLOAD_TOO_LARGE",
            ),
            (
                AppError::unsupported_media_type("unsupported media type"),
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                41500,
                "UNSUPPORTED_MEDIA_TYPE",
            ),
            (
                AppError::unprocessable_entity("unprocessable entity"),
                StatusCode::UNPROCESSABLE_ENTITY,
                42200,
                "UNPROCESSABLE_ENTITY",
            ),
            (
                AppError::not_found("not found"),
                StatusCode::NOT_FOUND,
                40400,
                "NOT_FOUND",
            ),
            (
                AppError::method_not_allowed("method not allowed"),
                StatusCode::METHOD_NOT_ALLOWED,
                40500,
                "METHOD_NOT_ALLOWED",
            ),
            (
                AppError::conflict("conflict"),
                StatusCode::CONFLICT,
                40900,
                "CONFLICT",
            ),
            (
                AppError::too_many_requests("too many requests"),
                StatusCode::TOO_MANY_REQUESTS,
                42900,
                "TOO_MANY_REQUESTS",
            ),
            (
                AppError::bad_gateway("bad gateway"),
                StatusCode::BAD_GATEWAY,
                50200,
                "BAD_GATEWAY",
            ),
            (
                AppError::service_unavailable("service unavailable"),
                StatusCode::SERVICE_UNAVAILABLE,
                50300,
                "SERVICE_UNAVAILABLE",
            ),
            (
                AppError::internal("internal"),
                StatusCode::INTERNAL_SERVER_ERROR,
                50000,
                "INTERNAL",
            ),
        ];

        for (error, expected_status, expected_legacy_code, expected_stable_code) in cases {
            let expected_message = error.to_string();
            let (status, payload) = response_json(error).await;
            assert_eq!(status, expected_status);
            assert_eq!(payload["code"], expected_legacy_code);
            assert_eq!(payload["message"], expected_message);
            assert_eq!(payload["error"]["code"], expected_stable_code);
            assert_eq!(payload["error"]["http_status"], status.as_u16());
            assert_eq!(payload["error"]["details"], serde_json::json!({}));
        }
    }

    #[tokio::test]
    async fn domain_errors_keep_legacy_shape_and_reuse_domain_code() {
        let (status, ocr) = response_json(AppError::ocr_artifact_reuse(
            StatusCode::CONFLICT,
            "OCR_ARTIFACT_NOT_REUSABLE",
            "OCR artifact is not reusable",
            "missing_layout_data",
        ))
        .await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(ocr["code"], "OCR_ARTIFACT_NOT_REUSABLE");
        assert_eq!(ocr["message"], "OCR artifact is not reusable");
        assert_eq!(ocr["reason"], "missing_layout_data");
        assert_eq!(ocr["can_fallback_to_ocr"], true);
        assert_eq!(ocr["error"]["code"], ocr["code"]);
        assert_eq!(ocr["error"]["http_status"], 409);
        assert_eq!(
            ocr["error"]["details"],
            serde_json::json!({
                "reason": "missing_layout_data",
                "can_fallback_to_ocr": true,
            })
        );

        for (error, code, expected_status) in [
            (
                AppError::credential_reference(
                    StatusCode::NOT_FOUND,
                    "CREDENTIAL_NOT_FOUND",
                    "credential not found",
                ),
                "CREDENTIAL_NOT_FOUND",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::live_translation(
                    StatusCode::CONFLICT,
                    "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
                    "page not committed",
                ),
                "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
                StatusCode::CONFLICT,
            ),
        ] {
            let (status, payload) = response_json(error).await;
            assert_eq!(status, expected_status);
            assert_eq!(payload["code"], code);
            assert_eq!(payload["error"]["code"], code);
            assert_eq!(payload["error"]["http_status"], status.as_u16());
            assert_eq!(payload["error"]["details"], serde_json::json!({}));
        }
    }
}
