//! JSON 响应压缩（2026-11-03）：客户端说收 gzip（`Accept-Encoding`）时，大的 JSON 响应压缩再发。
//!
//! 726 页的书阅读页区块 8.6MB，以前原样传。只压已知长度、8KB 以上的 `application/json`：文件出口（带
//! `Accept-Ranges`，PDF 要按段读）、事件流、AI 的流式回答都不碰，响应头、分段请求和以前一样。

use axum::body::HttpBody;
use axum::http::{header, Response};
use tower_http::compression::predicate::Predicate;
use tower_http::compression::CompressionLayer;

const MIN_COMPRESSED_BYTES: u64 = 8 * 1024;

#[derive(Clone, Copy)]
pub(crate) struct LargeJson;

impl Predicate for LargeJson {
    fn should_compress<B>(&self, response: &Response<B>) -> bool
    where
        B: HttpBody,
    {
        let headers = response.headers();
        let is_json = headers
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.starts_with("application/json"));
        let large = response
            .body()
            .size_hint()
            .exact()
            .is_some_and(|size| size >= MIN_COMPRESSED_BYTES);
        is_json && large && !headers.contains_key(header::ACCEPT_RANGES)
    }
}

pub(crate) fn json_compression_layer() -> CompressionLayer<LargeJson> {
    CompressionLayer::new().compress_when(LargeJson)
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{header, Response};
    use tower_http::compression::predicate::Predicate;

    use super::LargeJson;

    fn response(content_type: &str, size: usize, ranges: bool) -> Response<Body> {
        let mut builder = Response::builder().header(header::CONTENT_TYPE, content_type);
        if ranges {
            builder = builder.header(header::ACCEPT_RANGES, "bytes");
        }
        builder.body(Body::from(vec![b'x'; size])).unwrap()
    }

    #[test]
    fn only_large_json_that_is_not_a_file_download_is_compressed() {
        assert!(LargeJson.should_compress(&response("application/json", 20_000, false)));
        assert!(!LargeJson.should_compress(&response("application/json", 2_000, false)));
        // 文件出口（下载的 JSON 产物，可按段读）
        assert!(!LargeJson.should_compress(&response("application/json", 20_000, true)));
        assert!(!LargeJson.should_compress(&response("text/event-stream", 20_000, false)));
        assert!(!LargeJson.should_compress(&response("application/pdf", 20_000, false)));
    }
}
