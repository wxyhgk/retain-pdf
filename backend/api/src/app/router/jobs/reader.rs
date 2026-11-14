//! 阅读：阅读页要的东西。

use crate::app::AppState;
use crate::routes::jobs::reader;

crate::endpoints! {
    state: AppState;
    /// 阅读页的区块位置（原文块和译文的对应）
    GET "/api/v1/jobs/:job_id/reader/regions" => reader::get_reader_regions, signed;
    /// 阅读页的元信息（原文、译文 PDF 的页数和页面尺寸）
    GET "/api/v1/jobs/:job_id/reader/metadata" => reader::get_reader_metadata, signed;
    /// 原文 Markdown 的 JSON 视图（图片链接已换成绝对地址）
    GET "/api/v1/jobs/:job_id/reader/markdown" => reader::get_markdown_document, signed;
}
