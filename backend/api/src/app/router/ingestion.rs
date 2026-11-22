//! 上传（`/uploads`）。只做 OCR 的旧别名 `/ocr/jobs/*` 2026-10-18 删了，OCR 任务也走 `/jobs/*`。

use crate::app::AppState;
use crate::routes::uploads;

crate::endpoints! {
    state: AppState;
    owner: ingest;
    /// 上传一个 PDF（不限请求体大小），建任务时用返回的 upload_id
    POST "/api/v1/uploads" => uploads::upload_pdf, signed by(web) [unlimited_body];
}
