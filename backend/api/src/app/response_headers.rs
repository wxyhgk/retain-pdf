//! 所有回应都带的头（2026-11-24），两个端口一样，挂在最外层（预检、未登记的地址、出错也有）：
//!
//! - `X-Content-Type-Options: nosniff`：浏览器按 `Content-Type` 处理，不自己猜（产物图片按扩展名给类型，
//!   不能被当成 HTML / 脚本跑）；
//! - `Referrer-Policy: no-referrer`：从后端给的文件页面（浏览器里直接打开的 PDF、图片）点出去不带地址；
//! - `X-RetainPDF-Version`：应用版本（和 `/health` 的 `version` 一样）。Docker 下网页和后端是两个镜像，
//!   前端可以拿它和自己的 `APP_VERSION` 比，看两边版本对不对得上。
//!
//! 处理函数自己写了 `X-Content-Type-Options` / `Referrer-Policy` 的不覆盖。文件出口另带
//! `Content-Security-Policy: sandbox`（PDF 除外），见 `routes/job_helpers.rs::stream_file`。

use axum::extract::Request;
use axum::http::{header, HeaderName, HeaderValue};
use axum::middleware::Next;
use axum::response::Response;

use crate::services::platform::{app_version, UNKNOWN_VERSION};

pub(crate) const VERSION_HEADER: HeaderName = HeaderName::from_static("x-retainpdf-version");

pub(crate) async fn add_common_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers
        .entry(header::X_CONTENT_TYPE_OPTIONS)
        .or_insert(HeaderValue::from_static("nosniff"));
    headers
        .entry(header::REFERRER_POLICY)
        .or_insert(HeaderValue::from_static("no-referrer"));
    let version = HeaderValue::from_str(app_version())
        .unwrap_or_else(|_| HeaderValue::from_static(UNKNOWN_VERSION));
    headers.insert(VERSION_HEADER, version);
    response
}
