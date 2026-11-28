//! 阅读：阅读页要的东西。

use crate::app::AppState;
use crate::routes::jobs::reader;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 阅读页的区块位置（原文块和译文的对应）；阅读页提问的自带 agent 也从这里读书
    GET "/api/v1/jobs/:job_id/reader/regions" => reader::get_reader_regions, signed by(web, agent);
    /// 阅读页的元信息（原文、译文 PDF 的页数和页面尺寸）
    GET "/api/v1/jobs/:job_id/reader/metadata" => reader::get_reader_metadata, signed by(web);
    /// rpr_fit 排的版面清单（HTML 页照它画；没有时 available: false 和补排的请求）
    GET "/api/v1/jobs/:job_id/reader/layout" => reader::get_reader_layout, signed by(web);
    /// 一页版面（rpr_layout_v1 的一页：covers、blocks），带 ETag
    GET "/api/v1/jobs/:job_id/reader/layout/pages/:page_idx" => reader::get_reader_layout_page, signed by(web);
    /// 原文 Markdown 的 JSON 视图（图片链接已换成绝对地址）
    GET "/api/v1/jobs/:job_id/reader/markdown" => reader::get_markdown_document, signed by(web);
}
