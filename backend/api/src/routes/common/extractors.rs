use std::num::NonZeroU64;

use axum::body::Bytes;
use axum::extract::multipart::{Field, MultipartError, MultipartRejection};
use axum::extract::rejection::{JsonRejection, PathRejection, QueryRejection};
use axum::extract::{FromRequest, FromRequestParts, Json, Multipart, Path, Query, Request};
use axum::http::{request::Parts, StatusCode};
use serde::de::DeserializeOwned;

use crate::error::{unknown_field_detail, AppError};

/// JSON extractor whose failures use the public API error envelope.
///
/// 请求体里有不认识的字段（目标类型 `deny_unknown_fields`）返回 400，消息带字段名；
/// 字段类型不对等其余不合 schema 的情况仍是 422。接口约定见 `docs/api/00-约定/02-认证与错误.md`。
#[derive(Debug)]
pub struct ApiJson<T>(pub T);

/// Query-string extractor whose failures use the public API error envelope.
#[derive(Debug)]
pub struct ApiQuery<T>(pub T);

/// Path-parameter extractor whose failures use the public API error envelope.
#[derive(Debug)]
pub struct ApiPath<T>(pub T);

/// Multipart extractor whose initial boundary rejection uses the public API error envelope.
#[derive(Debug)]
pub struct ApiMultipart(pub Multipart);

#[axum::async_trait]
impl<T, S> FromRequest<S> for ApiJson<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(req, state)
            .await
            .map(|Json(value)| Self(value))
            .map_err(safe_json_rejection)
    }
}

/// serde 的 `unknown field `x`, expected one of ...` 只带字段名，不带值，可以原样回给调用方。
fn unknown_field_message(rejection: &JsonRejection) -> Option<String> {
    let JsonRejection::JsonDataError(error) = rejection else {
        return None;
    };
    unknown_field_detail(&error.body_text())
}


/// 先收原始字节、做完别的检查（例如先验令牌）再解析请求体的接口用：报错和 [`ApiJson`] 一样
/// （不是 JSON 415、语法错 400、不认识的字段 400 带字段名、其余不合 schema 422），不回显请求里的值。
pub fn parse_json_body<T: DeserializeOwned>(
    headers: &axum::http::HeaderMap,
    body: &[u8],
) -> Result<T, AppError> {
    let is_json = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or("").trim().to_ascii_lowercase())
        .is_some_and(|essence| {
            essence == "application/json"
                || (essence.starts_with("application/") && essence.ends_with("+json"))
        });
    if !is_json {
        return Err(AppError::unsupported_media_type(
            "expected an application/json request body",
        ));
    }
    serde_json::from_slice(body).map_err(|error| match error.classify() {
        serde_json::error::Category::Data => unknown_field_detail(&error.to_string())
            .map(AppError::bad_request)
            .unwrap_or_else(|| {
                AppError::unprocessable_entity("JSON request body does not match the expected schema")
            }),
        _ => AppError::bad_request("invalid JSON request body"),
    })
}

#[axum::async_trait]
impl<T, S> FromRequestParts<S> for ApiQuery<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Query::<T>::from_request_parts(parts, state)
            .await
            .map(|Query(value)| Self(value))
            .map_err(safe_query_rejection)
    }
}

#[axum::async_trait]
impl<T, S> FromRequestParts<S> for ApiPath<T>
where
    T: DeserializeOwned + Send,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<T>::from_request_parts(parts, state)
            .await
            .map(|Path(value)| Self(value))
            .map_err(safe_path_rejection)
    }
}

#[axum::async_trait]
impl<S> FromRequest<S> for ApiMultipart
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        Multipart::from_request(req, state)
            .await
            .map(Self)
            .map_err(safe_multipart_rejection)
    }
}

fn safe_json_rejection(rejection: JsonRejection) -> AppError {
    if let Some(message) = unknown_field_message(&rejection) {
        return AppError::bad_request(message);
    }
    match rejection {
        JsonRejection::JsonDataError(_) => {
            AppError::unprocessable_entity("JSON request body does not match the expected schema")
        }
        JsonRejection::JsonSyntaxError(_) => AppError::bad_request("invalid JSON request body"),
        JsonRejection::MissingJsonContentType(_) => {
            AppError::unsupported_media_type("expected an application/json request body")
        }
        JsonRejection::BytesRejection(rejection)
            if rejection.status() == StatusCode::PAYLOAD_TOO_LARGE =>
        {
            AppError::payload_too_large("request body is too large")
        }
        JsonRejection::BytesRejection(_) => {
            AppError::bad_request("unable to read JSON request body")
        }
        _ => AppError::bad_request("invalid JSON request body"),
    }
}

/// 查询串里不认识的参数（`deny_unknown_fields`）：和请求体一样回字段名，不带值。其余解析错误
/// （类型不对、缺参数）照旧是固定文案，不把 serde 原文回给调用方。
fn safe_query_rejection(rejection: QueryRejection) -> AppError {
    if let QueryRejection::FailedToDeserializeQueryString(error) = &rejection {
        let text = error.body_text();
        if let Some(start) = text.find("unknown field ") {
            return AppError::bad_request(format!("{} in the query string", &text[start..]));
        }
    }
    AppError::bad_request("invalid query parameters")
}

fn safe_path_rejection(_rejection: PathRejection) -> AppError {
    AppError::bad_request("invalid path parameters")
}

fn safe_multipart_rejection(_rejection: MultipartRejection) -> AppError {
    AppError::bad_request("invalid multipart request")
}

/// Converts errors raised while consuming multipart fields without exposing parser details.
///
/// Unlike `MultipartRejection`, these errors happen after extraction, when a handler calls
/// `next_field`, `bytes`, or `text`.
pub fn safe_multipart_error(error: MultipartError) -> AppError {
    match error.status() {
        StatusCode::PAYLOAD_TOO_LARGE => AppError::payload_too_large("request body is too large"),
        StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::internal("unable to read multipart request body")
        }
        _ => AppError::bad_request("invalid multipart request body"),
    }
}

/// Reads one multipart field without ever buffering more than `max_bytes`.
///
/// The limit is enforced against bytes actually received from the field stream. Request headers,
/// including `Content-Length`, are intentionally not used as an authority.
pub async fn read_multipart_field_limited(
    mut field: Field<'_>,
    max_bytes: NonZeroU64,
) -> Result<Bytes, AppError> {
    let mut byte_count = 0_u64;
    let mut output = Vec::new();

    while let Some(chunk) = field.chunk().await.map_err(safe_multipart_error)? {
        let chunk_len = u64::try_from(chunk.len()).map_err(|_| multipart_too_large())?;
        let next_byte_count = byte_count
            .checked_add(chunk_len)
            .ok_or_else(multipart_too_large)?;
        if next_byte_count > max_bytes.get() {
            return Err(multipart_too_large());
        }
        output.extend_from_slice(&chunk);
        byte_count = next_byte_count;
    }

    Ok(Bytes::from(output))
}

/// Reads one UTF-8 multipart text field with the same byte bound as the binary helper.
pub async fn read_multipart_text_limited(
    field: Field<'_>,
    max_bytes: NonZeroU64,
) -> Result<String, AppError> {
    let bytes = read_multipart_field_limited(field, max_bytes).await?;
    String::from_utf8(bytes.to_vec())
        .map_err(|_| AppError::bad_request("multipart text field is not valid UTF-8"))
}

fn multipart_too_large() -> AppError {
    AppError::payload_too_large("request body is too large")
}

#[cfg(test)]
mod tests {
    use std::num::NonZeroU64;

    use axum::body::{to_bytes, Body};
    use axum::extract::DefaultBodyLimit;
    use axum::http::{header, Method, Request};
    use axum::routing::{get, post};
    use axum::Router;
    use serde::Deserialize;
    use serde_json::Value;
    use tower::ServiceExt;

    use super::*;

    #[derive(Deserialize)]
    struct NumericValue {
        value: u64,
    }

    async fn extract_json(ApiJson(payload): ApiJson<NumericValue>) {
        let _ = payload.value;
    }

    async fn extract_query(ApiQuery(payload): ApiQuery<NumericValue>) {
        let _ = payload.value;
    }

    async fn extract_path(ApiPath(value): ApiPath<u64>) {
        let _ = value;
    }

    async fn extract_multipart(ApiMultipart(_multipart): ApiMultipart) {}

    async fn consume_multipart(ApiMultipart(mut multipart): ApiMultipart) -> Result<(), AppError> {
        while let Some(field) = multipart.next_field().await.map_err(safe_multipart_error)? {
            field.bytes().await.map_err(safe_multipart_error)?;
        }
        Ok(())
    }

    async fn consume_bounded_multipart(
        ApiMultipart(mut multipart): ApiMultipart,
    ) -> Result<Bytes, AppError> {
        let field = multipart
            .next_field()
            .await
            .map_err(safe_multipart_error)?
            .ok_or_else(|| AppError::bad_request("multipart field is required"))?;
        read_multipart_field_limited(field, NonZeroU64::new(5).unwrap()).await
    }

    async fn consume_bounded_multipart_text(
        ApiMultipart(mut multipart): ApiMultipart,
    ) -> Result<String, AppError> {
        let field = multipart
            .next_field()
            .await
            .map_err(safe_multipart_error)?
            .ok_or_else(|| AppError::bad_request("multipart field is required"))?;
        read_multipart_text_limited(field, NonZeroU64::new(5).unwrap()).await
    }

    fn multipart_request(value: &str) -> Request<Body> {
        multipart_request_bytes(value.as_bytes())
    }

    fn multipart_request_bytes(value: &[u8]) -> Request<Body> {
        let boundary = "retainpdf-bounded-field";
        let mut body =
            format!("--{boundary}\r\nContent-Disposition: form-data; name=\"value\"\r\n\r\n")
                .into_bytes();
        body.extend_from_slice(value);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        Request::builder()
            .method(Method::POST)
            .uri("/multipart")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(body))
            .unwrap()
    }

    async fn error_payload(response: axum::response::Response) -> (StatusCode, Value) {
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body");
        let payload = serde_json::from_slice(&body).expect("parse response JSON");
        (status, payload)
    }

    fn assert_error(payload: &Value, legacy_code: i64, stable_code: &str) {
        assert_eq!(payload["code"], legacy_code);
        assert_eq!(payload["error"]["code"], stable_code);
        assert_eq!(payload["error"]["details"], serde_json::json!({}));
    }

    #[tokio::test]
    async fn json_rejections_preserve_safe_protocol_statuses() {
        let router = Router::new().route("/json", post(extract_json));

        let syntax = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/json")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from("{"))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(syntax).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_error(&payload, 40000, "BAD_REQUEST");

        let data = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/json")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"value":"not-a-number"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(data).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_error(&payload, 42200, "UNPROCESSABLE_ENTITY");

        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        #[allow(dead_code)]
        struct Strict {
            value: u64,
        }
        async fn extract_strict(ApiJson(_payload): ApiJson<Strict>) {}
        let unknown = Router::new()
            .route("/strict", post(extract_strict))
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/strict")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"value":1,"extra":true}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(unknown).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "不认识的字段是请求写错了");
        assert_error(&payload, 40000, "BAD_REQUEST");
        assert!(payload["message"].as_str().unwrap().starts_with("unknown field `extra`"));

        let missing_content_type = router
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/json")
                    .body(Body::from(r#"{"value":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(missing_content_type).await;
        assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
        assert_error(&payload, 41500, "UNSUPPORTED_MEDIA_TYPE");
    }

    #[tokio::test]
    async fn body_limit_rejection_is_safe_and_keeps_413() {
        let response = Router::new()
            .route("/json", post(extract_json))
            .layer(DefaultBodyLimit::max(4))
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/json")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(r#"{"value":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(response).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_error(&payload, 41300, "PAYLOAD_TOO_LARGE");
    }

    #[tokio::test]
    async fn multipart_body_limit_is_safe_and_keeps_413_during_consumption() {
        let boundary = "retainpdf-test-boundary";
        let body = format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"value\"\r\n\r\n{}\r\n--{boundary}--\r\n",
            "x".repeat(128)
        );
        let response = Router::new()
            .route("/multipart", post(consume_multipart))
            .layer(DefaultBodyLimit::max(64))
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/multipart")
                    .header(
                        header::CONTENT_TYPE,
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        let (status, payload) = error_payload(response).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_error(&payload, 41300, "PAYLOAD_TOO_LARGE");
    }

    #[tokio::test]
    async fn bounded_multipart_field_accepts_exact_limit() {
        let response = Router::new()
            .route("/multipart", post(consume_bounded_multipart))
            .oneshot(multipart_request("12345"))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(&body[..], b"12345");
    }

    #[tokio::test]
    async fn bounded_multipart_field_rejects_over_limit_with_safe_413() {
        let mut request = multipart_request("123456");
        request
            .headers_mut()
            .insert(header::CONTENT_LENGTH, "1".parse().unwrap());
        let response = Router::new()
            .route("/multipart", post(consume_bounded_multipart))
            .oneshot(request)
            .await
            .unwrap();

        let (status, payload) = error_payload(response).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_error(&payload, 41300, "PAYLOAD_TOO_LARGE");
        assert_eq!(payload["message"], "request body is too large");
        assert!(!payload["message"].as_str().unwrap().contains("123456"));
    }

    #[tokio::test]
    async fn bounded_multipart_text_decodes_utf8_within_limit() {
        let response = Router::new()
            .route("/multipart", post(consume_bounded_multipart_text))
            .oneshot(multipart_request("hello"))
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(&body[..], b"hello");
    }

    #[tokio::test]
    async fn bounded_multipart_text_rejects_invalid_utf8_with_safe_400() {
        let response = Router::new()
            .route("/multipart", post(consume_bounded_multipart_text))
            .oneshot(multipart_request_bytes(&[0xff]))
            .await
            .unwrap();

        let (status, payload) = error_payload(response).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_error(&payload, 40000, "BAD_REQUEST");
        assert_eq!(
            payload["message"],
            "multipart text field is not valid UTF-8"
        );
        assert!(!payload["message"]
            .as_str()
            .unwrap()
            .contains("invalid byte"));
    }

    #[tokio::test]
    async fn query_path_and_multipart_rejections_use_safe_bad_request() {
        let router = Router::new()
            .route("/query", get(extract_query))
            .route("/path/:value", get(extract_path))
            .route("/multipart", post(extract_multipart));

        for request in [
            Request::builder()
                .uri("/query?value=not-a-number")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .uri("/path/not-a-number")
                .body(Body::empty())
                .unwrap(),
            Request::builder()
                .method(Method::POST)
                .uri("/multipart")
                .header(header::CONTENT_TYPE, "multipart/form-data")
                .body(Body::empty())
                .unwrap(),
        ] {
            let response = router.clone().oneshot(request).await.unwrap();
            let (status, payload) = error_payload(response).await;
            assert_eq!(status, StatusCode::BAD_REQUEST);
            assert_error(&payload, 40000, "BAD_REQUEST");
        }
    }
}
