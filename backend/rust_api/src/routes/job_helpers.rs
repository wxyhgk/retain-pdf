use std::path::PathBuf;

use crate::error::AppError;
use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio_util::io::ReaderStream;

pub async fn stream_file(
    path: PathBuf,
    content_type: &str,
    download_name: Option<String>,
    headers: Option<&HeaderMap>,
) -> Result<Response, AppError> {
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "file not found: {}",
            path.display()
        )));
    }
    let total_size = tokio::fs::metadata(&path).await?.len();
    let range = headers
        .and_then(|headers| parse_range_header(headers, total_size).transpose())
        .transpose()?;
    let (status, body, content_length, content_range) = if let Some(range) = range {
        let mut file = tokio::fs::File::open(&path).await?;
        file.seek(SeekFrom::Start(range.start)).await?;
        let stream = ReaderStream::new(file.take(range.len()));
        (
            StatusCode::PARTIAL_CONTENT,
            Body::from_stream(stream),
            range.len(),
            Some(format!(
                "bytes {}-{}/{}",
                range.start, range.end, total_size
            )),
        )
    } else {
        let file = tokio::fs::File::open(&path).await?;
        let stream = ReaderStream::new(file);
        (StatusCode::OK, Body::from_stream(stream), total_size, None)
    };
    let mut response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, content_length.to_string())
        .body(body)
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(content_range) = content_range {
        response.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&content_range).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    response.headers_mut().insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("Accept-Ranges, Content-Range, Content-Length, X-Job-Id"),
    );
    if let Some(name) = download_name {
        let value = format!("attachment; filename=\"{name}\"");
        response.headers_mut().insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&value).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    Ok(response)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ByteRange {
    start: u64,
    end: u64,
}

impl ByteRange {
    fn len(self) -> u64 {
        self.end.saturating_sub(self.start) + 1
    }
}

fn parse_range_header(headers: &HeaderMap, total_size: u64) -> Result<Option<ByteRange>, AppError> {
    let Some(value) = headers.get(header::RANGE) else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| AppError::bad_request("invalid Range header"))?
        .trim();
    if total_size == 0 {
        return Err(AppError::bad_request("Range not supported for empty file"));
    }
    let Some(spec) = value.strip_prefix("bytes=") else {
        return Err(AppError::bad_request("only bytes Range is supported"));
    };
    if spec.contains(',') {
        return Err(AppError::bad_request(
            "multiple byte ranges are not supported",
        ));
    }
    let (start_raw, end_raw) = spec
        .split_once('-')
        .ok_or_else(|| AppError::bad_request("invalid Range header"))?;
    let range = if start_raw.trim().is_empty() {
        let suffix_len = end_raw
            .trim()
            .parse::<u64>()
            .map_err(|_| AppError::bad_request("invalid suffix byte range"))?;
        if suffix_len == 0 {
            return Err(AppError::bad_request("invalid suffix byte range"));
        }
        let len = suffix_len.min(total_size);
        ByteRange {
            start: total_size - len,
            end: total_size - 1,
        }
    } else {
        let start = start_raw
            .trim()
            .parse::<u64>()
            .map_err(|_| AppError::bad_request("invalid Range start"))?;
        if start >= total_size {
            return Err(AppError::bad_request("Range start exceeds file size"));
        }
        let end = if end_raw.trim().is_empty() {
            total_size - 1
        } else {
            end_raw
                .trim()
                .parse::<u64>()
                .map_err(|_| AppError::bad_request("invalid Range end"))?
                .min(total_size - 1)
        };
        if end < start {
            return Err(AppError::bad_request("Range end precedes start"));
        }
        ByteRange { start, end }
    };
    Ok(Some(range))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::HeaderMap;

    #[tokio::test]
    async fn stream_file_sets_content_disposition_when_download_name_provided() {
        let temp_path = std::env::temp_dir().join(format!(
            "job-helpers-stream-{}-{}.txt",
            std::process::id(),
            fastrand::u64(..)
        ));
        tokio::fs::write(&temp_path, b"hello world")
            .await
            .expect("write temp file");

        let response = stream_file(
            temp_path.clone(),
            "text/plain",
            Some("result.txt".to_string()),
            None,
        )
        .await
        .expect("stream response");

        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok());
        let content_disposition = response
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .and_then(|value| value.to_str().ok());
        assert_eq!(content_type, Some("text/plain"));
        assert_eq!(
            content_disposition,
            Some("attachment; filename=\"result.txt\"")
        );

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body");
        assert_eq!(body.as_ref(), b"hello world");

        let _ = tokio::fs::remove_file(temp_path).await;
    }

    #[tokio::test]
    async fn stream_file_supports_byte_range_requests() {
        let temp_path = std::env::temp_dir().join(format!(
            "job-helpers-range-{}-{}.pdf",
            std::process::id(),
            fastrand::u64(..)
        ));
        tokio::fs::write(&temp_path, b"0123456789")
            .await
            .expect("write temp file");
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, HeaderValue::from_static("bytes=2-5"));

        let response = stream_file(temp_path.clone(), "application/pdf", None, Some(&headers))
            .await
            .expect("range response");

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(
            response
                .headers()
                .get(header::ACCEPT_RANGES)
                .and_then(|value| value.to_str().ok()),
            Some("bytes")
        );
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_RANGE)
                .and_then(|value| value.to_str().ok()),
            Some("bytes 2-5/10")
        );
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_LENGTH)
                .and_then(|value| value.to_str().ok()),
            Some("4")
        );
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body");
        assert_eq!(body.as_ref(), b"2345");

        let _ = tokio::fs::remove_file(temp_path).await;
    }
}
