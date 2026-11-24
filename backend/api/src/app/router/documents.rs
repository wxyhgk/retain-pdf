//! 书（文档）：一本 PDF 是一本书，同一本书的多个任务挂在它下面；书本身的文件；全文检索。

use crate::app::AppState;
use crate::routes::{library_data, tags};

crate::endpoints! {
    state: AppState;
    owner: library;
    /// 书列表
    GET "/api/v1/documents" => library_data::list_documents_route, signed by(web);
    /// 一本书
    GET "/api/v1/documents/:document_id" => library_data::get_document_route, signed by(web);
    /// 改书的信息（书名、阅读状态）
    PATCH "/api/v1/documents/:document_id" => library_data::patch_document_route, signed by(web);
    /// 设书的标签（设成正好这几个）
    PUT "/api/v1/documents/:document_id/tags" => tags::set_document_tags_route, signed by(none);
    /// 删除一本书和它的任务
    DELETE "/api/v1/documents/:document_id" => library_data::delete_document_route, signed by(web);
    /// 哪些页已经有译文
    GET "/api/v1/documents/:document_id/translation-coverage" => library_data::get_document_translation_coverage_route, signed by(web);
    /// 阅读这本书该打开哪个任务（含合并阅读）；`version` 选译文版本
    GET "/api/v1/documents/:document_id/reading" => library_data::get_document_reading_route, signed by(web);
    /// 这本书的译文版本和当前版本
    GET "/api/v1/documents/:document_id/translation-versions" => library_data::list_document_translation_versions_route, signed by(web);
    /// 切换当前译文版本（null 回到自动：逐页取最新）
    PUT "/api/v1/documents/:document_id/translation-version" => library_data::set_document_translation_version_route, signed by(web);
    /// 给译文版本改名、隐藏或恢复
    PATCH "/api/v1/documents/:document_id/translation-versions/:version_id" => library_data::patch_document_translation_version_route, signed by(web);
    /// 书本身的文件清单：原文、封面、缩略图、原文页预览
    GET "/api/v1/documents/:document_id/files" => library_data::list_document_files_route, signed by(none);
    /// 取书的一个文件：source.pdf、cover.jpg、thumbnail.jpg
    GET "/api/v1/documents/:document_id/files/:name" => library_data::document_file_route, signed by(web);
    /// 原文某一页的预览图
    GET "/api/v1/documents/:document_id/files/pages/:page" => library_data::document_page_file_route, signed by(none);
    /// 翻译这本书（建翻译任务，能复用已有的 OCR）
    POST "/api/v1/documents/:document_id/translate" => library_data::translate_document_route, signed by(web) [idempotent];
    /// 给这本书做 OCR
    POST "/api/v1/documents/:document_id/ocr" => library_data::ocr_document_route, signed by(web) [idempotent];
    /// 书的元信息建议（书名、作者……）
    GET "/api/v1/documents/:document_id/metadata-suggestions" => library_data::list_document_metadata_suggestions_route, signed by(web);
    /// 生成一条元信息建议
    POST "/api/v1/documents/:document_id/metadata-suggestions" => library_data::create_document_metadata_suggestion_route, signed by(web);
    /// 采用一条元信息建议
    POST "/api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply" => library_data::apply_document_metadata_suggestion_route, signed by(web);
    /// 这本书的任务历史
    GET "/api/v1/documents/:document_id/jobs" => library_data::list_document_jobs_route, signed by(web);
    /// 全文检索
    GET "/api/v1/search" => library_data::search_blocks_route, signed by(web);
}
