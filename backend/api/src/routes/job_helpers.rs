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
    let metadata = tokio::fs::metadata(&path).await?;
    let total_size = metadata.len();
    // 校验器：内容没变时浏览器带着 If-None-Match 来问，直接回 304、不再传文件。
    let etag = file_etag(&path);
    let last_modified = metadata.modified().ok().map(httpdate::fmt_http_date);
    if let (Some(etag), Some(headers)) = (etag.as_deref(), headers) {
        if headers.get(header::RANGE).is_none() && if_none_match_hits(headers, etag) {
            let mut response = Response::builder()
                .status(StatusCode::NOT_MODIFIED)
                .body(Body::empty())
                .map_err(|e| AppError::internal(e.to_string()))?;
            set_validators(&mut response, Some(etag), last_modified.as_deref());
            return Ok(response);
        }
    }
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
        HeaderValue::from_static("Accept-Ranges, Content-Range, Content-Length, X-Job-Id, ETag, Last-Modified"),
    );
    set_validators(&mut response, etag.as_deref(), last_modified.as_deref());
    if let Some(name) = download_name {
        set_content_disposition(&mut response, "attachment", &name)?;
    }
    Ok(response)
}

fn if_none_match_hits(headers: &HeaderMap, etag: &str) -> bool {
    headers
        .get_all(header::IF_NONE_MATCH)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .map(|candidate| candidate.trim().trim_start_matches("W/"))
        .any(|candidate| candidate == "*" || candidate == etag)
}

fn set_validators(response: &mut Response, etag: Option<&str>, last_modified: Option<&str>) {
    for (name, value) in [(header::ETAG, etag), (header::LAST_MODIFIED, last_modified)] {
        if let Some(value) = value.and_then(|value| HeaderValue::from_str(value).ok()) {
            response.headers_mut().insert(name, value);
        }
    }
}

/// 封面、缩略图从源 PDF 生成，而书的编号就是源 PDF 的指纹：同一个地址的图几乎不会变。
/// 让浏览器缓存一天、过期后带 ETag 来问（没变回 304）。首页几十张缩略图不再每次重下。
pub fn with_image_cache(mut response: Response) -> Response {
    if response.status().is_success() || response.status() == StatusCode::NOT_MODIFIED {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, max-age=86400"),
        );
    }
    response
}

/// 写 Content-Disposition，带 ASCII 兜底名和 RFC 5987 的 `filename*=UTF-8''…`。
///
/// 以前是 `filename="{name}"` 直接塞 UTF-8：头部按 latin-1 解读，中文书名在浏览器里成乱码。
/// `kind` 是 `attachment`（强制下载）或 `inline`（照常在浏览器里打开，只是另存 / fetch
/// 下载时有名字可用）。
pub fn set_content_disposition(response: &mut Response, kind: &str, name: &str) -> Result<(), AppError> {
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&content_disposition_value(kind, name))
            .map_err(|e| AppError::internal(e.to_string()))?,
    );
    Ok(())
}

pub fn content_disposition_value(kind: &str, name: &str) -> String {
    let fallback: String = name
        .chars()
        .map(|ch| if ch.is_ascii_graphic() || ch == ' ' { ch } else { '_' })
        .map(|ch| if ch == '"' || ch == '\\' { '_' } else { ch })
        .collect();
    let mut encoded = String::new();
    for byte in name.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || "!#$&+-.^_`|~".contains(ch) {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    format!("{kind}; filename=\"{fallback}\"; filename*=UTF-8''{encoded}")
}

pub fn file_etag(path: &std::path::Path) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    let len = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    Some(format!("\"{len:x}-{modified:x}\""))
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

    /// 带 ETag 回来问、文件没变：304 不带正文；文件变了：200 带新 ETag。Range 请求不走 304。
    #[tokio::test]
    async fn stream_file_answers_unchanged_files_with_not_modified() {
        let temp_path = std::env::temp_dir().join(format!(
            "job-helpers-etag-{}-{}.png",
            std::process::id(),
            fastrand::u64(..)
        ));
        tokio::fs::write(&temp_path, b"thumbnail-bytes").await.unwrap();

        let first = stream_file(temp_path.clone(), "image/png", None, Some(&HeaderMap::new())).await.unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let etag = first.headers().get(header::ETAG).unwrap().to_str().unwrap().to_string();
        assert!(first.headers().get(header::LAST_MODIFIED).is_some());

        let mut revalidate = HeaderMap::new();
        revalidate.insert(header::IF_NONE_MATCH, HeaderValue::from_str(&etag).unwrap());
        let second = stream_file(temp_path.clone(), "image/png", None, Some(&revalidate)).await.unwrap();
        assert_eq!(second.status(), StatusCode::NOT_MODIFIED);
        assert_eq!(second.headers().get(header::ETAG).unwrap(), etag.as_str());
        assert!(to_bytes(second.into_body(), usize::MAX).await.unwrap().is_empty());

        let mut ranged = revalidate.clone();
        ranged.insert(header::RANGE, HeaderValue::from_static("bytes=0-3"));
        let partial = stream_file(temp_path.clone(), "image/png", None, Some(&ranged)).await.unwrap();
        assert_eq!(partial.status(), StatusCode::PARTIAL_CONTENT);

        tokio::fs::write(&temp_path, b"regenerated-thumbnail-bytes").await.unwrap();
        let changed = stream_file(temp_path.clone(), "image/png", None, Some(&revalidate)).await.unwrap();
        assert_eq!(changed.status(), StatusCode::OK, "内容（长度）变了 ETag 就变");

        let cached = with_image_cache(changed);
        assert_eq!(cached.headers().get(header::CACHE_CONTROL).unwrap(), "private, max-age=86400");
        let _ = tokio::fs::remove_file(&temp_path).await;
    }

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
            Some("attachment; filename=\"result.txt\"; filename*=UTF-8''result.txt")
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

    #[test]
    fn file_etag_uses_file_metadata() {
        let path =
            std::env::temp_dir().join(format!("rust-api-preview-etag-{}.jpg", fastrand::u64(..)));
        std::fs::write(&path, b"preview-image").expect("write preview");
        let etag = file_etag(&path).expect("etag");
        assert!(etag.starts_with('"'));
        assert!(etag.ends_with('"'));
        assert!(etag.contains("-"));
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn content_disposition_keeps_non_ascii_names_readable() {
        assert_eq!(
            super::content_disposition_value("attachment", "zh_共轭 卤素_translated.pdf"),
            "attachment; filename=\"zh___ ___translated.pdf\"; filename*=UTF-8''zh_%E5%85%B1%E8%BD%AD%20%E5%8D%A4%E7%B4%A0_translated.pdf"
        );
        assert_eq!(
            super::content_disposition_value("inline", "a \"b\".pdf"),
            "inline; filename=\"a _b_.pdf\"; filename*=UTF-8''a%20%22b%22.pdf"
        );
    }
}
